use crate::bot_tests::register_bot;
use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, client};
use candid::Principal;
use local_user_index_canister::bot_send_message::Response as SendResponse;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::collections::HashSet;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::{
    BotChatContext, BotInstallationLocation, BotMessageContent, BotPermissions, CanisterId, Chat, ChatEvent,
    DiscordMessageContext, DiscordUser, EventsResponse, MessagePermission, SenderContext, TextContent, UnitResult, UserId,
};

#[test]
fn discord_bot_relays_messages_as_their_discord_authors() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let community_id =
        client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);
    let channel_id = client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
    let channel = Chat::Channel(community_id, channel_id);
    let community_local_user_index = canister_ids.local_user_index(env, community_id);
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
    let group = Chat::Group(group_id);
    let group_local_user_index = canister_ids.local_user_index(env, group_id);

    let (discord_bot_id, discord_bot_principal) =
        register_bot(env, &owner, canister_ids.user_index, random_string(), random_string());
    let (other_bot_id, other_bot_principal) =
        register_bot(env, &owner, canister_ids.user_index, random_string(), random_string());

    let permissions = BotPermissions::default().with_message(&HashSet::from_iter([MessagePermission::Text]));
    for (local_user_index, location, bot_id) in [
        (
            community_local_user_index,
            BotInstallationLocation::Community(community_id),
            discord_bot_id,
        ),
        (
            community_local_user_index,
            BotInstallationLocation::Community(community_id),
            other_bot_id,
        ),
        (
            group_local_user_index,
            BotInstallationLocation::Group(group_id),
            discord_bot_id,
        ),
    ] {
        client::local_user_index::happy_path::install_bot(
            env,
            owner.principal,
            local_user_index,
            location,
            bot_id,
            permissions.clone(),
            Some(permissions.clone()),
        );
    }

    // Set the Discord bot the way the admin page sets it: on the UserIndex, which fans it out to
    // every LocalUserIndex
    let operator = client::register_user(env, canister_ids);
    client::user_index::happy_path::add_platform_operator(env, *controller, canister_ids.user_index, operator.user_id);
    tick_many(env, 3);

    let response = set_discord_bot(env, operator.principal, canister_ids.user_index, Some(owner.user_id));
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::BotNotFound)),
        "{response:?}"
    );

    let response = set_discord_bot(env, operator.principal, canister_ids.user_index, Some(discord_bot_id));
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    tick_many(env, 3);

    let discord = DiscordMessageContext {
        author: DiscordUser {
            id: 80351110224678912,
            username: "nelly".to_string(),
            display_name: Some("Nelly".to_string()),
            avatar: Some("8342729096ea3675442027381ff50dfe".to_string()),
        },
    };

    // Relayed into a channel and into a group, each message keeps its Discord author
    let response = send(
        env,
        discord_bot_principal,
        community_local_user_index,
        channel,
        discord.clone(),
    );
    let SendResponse::Success(result) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };
    let events =
        client::community::happy_path::events_by_index(env, &owner, community_id, channel_id, vec![result.event_index]);
    assert_relayed_from(&events, discord_bot_id, &discord);

    let response = send(env, discord_bot_principal, group_local_user_index, group, discord.clone());
    let SendResponse::Success(result) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };
    let events = client::group::happy_path::events_by_index(env, &owner, group_id, vec![result.event_index]);
    assert_relayed_from(&events, discord_bot_id, &discord);

    // An author Discord itself wouldn't send is rejected
    let response = send(
        env,
        discord_bot_principal,
        community_local_user_index,
        channel,
        DiscordMessageContext {
            author: DiscordUser {
                avatar: Some("https://example.com/avatar.png".to_string()),
                ..discord.author.clone()
            },
        },
    );
    assert!(
        matches!(&response, SendResponse::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "{response:?}"
    );

    // Messages from Discord only go to groups and channels
    let response = send(
        env,
        discord_bot_principal,
        community_local_user_index,
        Chat::Direct(owner.user_id.into()),
        discord.clone(),
    );
    assert!(
        matches!(&response, SendResponse::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "{response:?}"
    );

    // Any other bot is refused
    let response = send(env, other_bot_principal, community_local_user_index, channel, discord.clone());
    assert!(
        matches!(&response, SendResponse::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "{response:?}"
    );

    // As is the Discord bot once it's unset, which also leaves the pooled env as it was
    let response = set_discord_bot(env, operator.principal, canister_ids.user_index, None);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    tick_many(env, 3);

    let response = send(env, discord_bot_principal, community_local_user_index, channel, discord);
    assert!(
        matches!(&response, SendResponse::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "{response:?}"
    );
}

fn set_discord_bot(env: &mut PocketIc, operator: Principal, user_index: CanisterId, bot_id: Option<UserId>) -> UnitResult {
    client::user_index::set_discord_bot(
        env,
        operator,
        user_index,
        &user_index_canister::set_discord_bot::Args { bot_id },
    )
}

fn send(
    env: &mut PocketIc,
    bot_principal: Principal,
    local_user_index: CanisterId,
    chat: Chat,
    discord: DiscordMessageContext,
) -> SendResponse {
    client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Autonomous(chat),
            thread: None,
            message_id: None,
            replies_to: None,
            content: BotMessageContent::Text(TextContent {
                text: "Hello from Discord".to_string(),
            }),
            block_level_markdown: false,
            finalised: true,
            og_previews: None,
            discord: Some(discord),
        },
    )
}

fn assert_relayed_from(events: &EventsResponse, discord_bot_id: UserId, discord: &DiscordMessageContext) {
    let ChatEvent::Message(message) = &events.events[0].event else {
        panic!("Expected a message: {:?}", events.events[0].event);
    };
    assert_eq!(message.sender, discord_bot_id);
    let Some(SenderContext::Bot(bot_context)) = &message.sender_context else {
        panic!("Expected a bot sender context: {:?}", message.sender_context);
    };
    assert_eq!(bot_context.discord.as_deref(), Some(discord));
}
