use crate::bot_tests::register_bot;
use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, client};
use candid::Principal;
use oc_error_codes::OCErrorCode;
use std::collections::HashSet;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::{
    BotChatContext, BotInstallationLocation, BotMessageContent, BotPermissions, CanisterId, Chat, ChatEvent,
    DiscordMessageContext, DiscordUser, MessagePermission, SenderContext, TextContent, UnitResult,
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
    let chat = Chat::Channel(community_id, channel_id);
    let local_user_index = canister_ids.local_user_index(env, community_id);

    let (discord_bot_id, discord_bot_principal) =
        register_bot(env, &owner, canister_ids.user_index, random_string(), random_string());
    let (other_bot_id, other_bot_principal) =
        register_bot(env, &owner, canister_ids.user_index, random_string(), random_string());

    let permissions = BotPermissions::default().with_message(&HashSet::from_iter([MessagePermission::Text]));
    for bot_id in [discord_bot_id, other_bot_id] {
        client::local_user_index::happy_path::install_bot(
            env,
            owner.principal,
            local_user_index,
            BotInstallationLocation::Community(community_id),
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

    let response = client::user_index::set_discord_bot(
        env,
        operator.principal,
        canister_ids.user_index,
        &user_index_canister::set_discord_bot::Args {
            bot_id: Some(owner.user_id),
        },
    );
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::BotNotFound)),
        "{response:?}"
    );

    let response = client::user_index::set_discord_bot(
        env,
        operator.principal,
        canister_ids.user_index,
        &user_index_canister::set_discord_bot::Args {
            bot_id: Some(discord_bot_id),
        },
    );
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

    let send = |env: &mut pocket_ic::PocketIc, bot_principal: Principal, discord: DiscordMessageContext| {
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
    };

    let response = send(env, discord_bot_principal, discord.clone());
    let local_user_index_canister::bot_send_message::Response::Success(result) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };

    let events =
        client::community::happy_path::events_by_index(env, &owner, community_id, channel_id, vec![result.event_index]);
    let ChatEvent::Message(message) = &events.events[0].event else {
        panic!("Expected a message: {:?}", events.events[0].event);
    };
    assert_eq!(message.sender, discord_bot_id);
    let Some(SenderContext::Bot(bot_context)) = &message.sender_context else {
        panic!("Expected a bot sender context: {:?}", message.sender_context);
    };
    assert_eq!(bot_context.discord.as_deref(), Some(&discord));

    // An author Discord itself wouldn't send is rejected
    let response = send(
        env,
        discord_bot_principal,
        DiscordMessageContext {
            author: DiscordUser {
                avatar: Some("https://example.com/avatar.png".to_string()),
                ..discord.author.clone()
            },
        },
    );
    assert!(
        matches!(&response, local_user_index_canister::bot_send_message::Response::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "{response:?}"
    );

    // Any other bot is refused
    let response = send(env, other_bot_principal, discord);
    assert!(
        matches!(&response, local_user_index_canister::bot_send_message::Response::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "{response:?}"
    );

    clear_discord_bot(env, operator.principal, canister_ids.user_index);
}

// Test envs are pooled, so the Discord bot is cleared for the next test to use the env
fn clear_discord_bot(env: &mut pocket_ic::PocketIc, operator: Principal, user_index: CanisterId) {
    let response = client::user_index::set_discord_bot(
        env,
        operator,
        user_index,
        &user_index_canister::set_discord_bot::Args { bot_id: None },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    tick_many(env, 3);
}
