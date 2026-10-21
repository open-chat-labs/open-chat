use crate::bot_tests::register_bot;
use crate::env::ENV;
use crate::utils::{tick_many, try_metrics};
use crate::{CanisterIds, TestEnv, client};
use candid::Principal;
use local_user_index_canister::bot_send_message::Response as SendResponse;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::collections::HashSet;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::{
    BlobReference, BotChatContext, BotInstallationLocation, BotMessageContent, BotPermissions, BridgePlatform, BridgedUser,
    CanisterId, Chat, ChatEvent, DiscordUser, EventsResponse, MessagePermission, SenderContext, TelegramUser, TextContent,
    UnitResult, UserId,
};

#[test]
fn bridge_bots_relay_messages_as_their_authors() {
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
    let (telegram_bot_id, telegram_bot_principal) =
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
            telegram_bot_id,
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

    // Set the bridge bots the way the admin page sets them: on the UserIndex, which fans them out to
    // every LocalUserIndex
    let operator = client::register_user(env, canister_ids);
    client::user_index::happy_path::add_platform_operator(env, *controller, canister_ids.user_index, operator.user_id);
    tick_many(env, 3);

    let response = set_bridge_bot(
        env,
        operator.principal,
        canister_ids.user_index,
        BridgePlatform::Discord,
        Some(owner.user_id),
    );
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::BotNotFound)),
        "{response:?}"
    );

    for (platform, bot_id) in [
        (BridgePlatform::Discord, discord_bot_id),
        (BridgePlatform::Telegram, telegram_bot_id),
    ] {
        let response = set_bridge_bot(env, operator.principal, canister_ids.user_index, platform, Some(bot_id));
        assert!(matches!(response, UnitResult::Success), "{response:?}");
        wait_for_bridge_bot_everywhere(env, canister_ids, platform, Some(bot_id));
    }

    let discord_author = DiscordUser {
        id: 80351110224678912,
        username: "nelly".to_string(),
        display_name: Some("Nelly".to_string()),
        avatar: Some("8342729096ea3675442027381ff50dfe".to_string()),
    };
    let from_discord = BridgedUser::Discord(discord_author.clone());
    let from_telegram = BridgedUser::Telegram(TelegramUser {
        id: 123456789,
        username: Some("nelly".to_string()),
        display_name: "Nelly Smith".to_string(),
        avatar: Some(BlobReference {
            canister_id: canister_ids.user_index,
            blob_id: 1,
        }),
    });

    // Relayed into a channel and into a group, each message keeps its author on the other platform
    let response = send(
        env,
        discord_bot_principal,
        community_local_user_index,
        channel,
        from_discord.clone(),
    );
    let SendResponse::Success(result) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };
    let events =
        client::community::happy_path::events_by_index(env, &owner, community_id, channel_id, vec![result.event_index]);
    assert_relayed_from(&events, discord_bot_id, &from_discord);
    // The message holds only the author's id. Their profile goes to the UserIndex's registry
    wait_for_bridged_user(env, canister_ids.user_index, &from_discord);

    let response = send(
        env,
        discord_bot_principal,
        group_local_user_index,
        group,
        from_discord.clone(),
    );
    let SendResponse::Success(result) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };
    let events = client::group::happy_path::events_by_index(env, &owner, group_id, vec![result.event_index]);
    assert_relayed_from(&events, discord_bot_id, &from_discord);

    let response = send(
        env,
        telegram_bot_principal,
        community_local_user_index,
        channel,
        from_telegram.clone(),
    );
    let SendResponse::Success(result) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };
    let events =
        client::community::happy_path::events_by_index(env, &owner, community_id, channel_id, vec![result.event_index]);
    assert_relayed_from(&events, telegram_bot_id, &from_telegram);
    wait_for_bridged_user(env, canister_ids.user_index, &from_telegram);

    // Each bridge bot can only relay messages from its own platform
    for (bot_principal, bridged_from) in [
        (discord_bot_principal, from_telegram.clone()),
        (telegram_bot_principal, from_discord.clone()),
    ] {
        let response = send(env, bot_principal, community_local_user_index, channel, bridged_from);
        assert!(
            matches!(&response, SendResponse::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
            "{response:?}"
        );
    }

    // An author the platform itself wouldn't send is rejected
    let response = send(
        env,
        discord_bot_principal,
        community_local_user_index,
        channel,
        BridgedUser::Discord(DiscordUser {
            avatar: Some("https://example.com/avatar.png".to_string()),
            ..discord_author.clone()
        }),
    );
    assert!(
        matches!(&response, SendResponse::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "{response:?}"
    );

    // Bridged messages only go to groups and channels
    let response = send(
        env,
        discord_bot_principal,
        community_local_user_index,
        Chat::Direct(owner.user_id.into()),
        from_discord.clone(),
    );
    assert!(
        matches!(&response, SendResponse::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "{response:?}"
    );

    // A changed profile replaces the one in the registry
    let renamed = BridgedUser::Discord(DiscordUser {
        display_name: Some("Nelly Smith".to_string()),
        ..discord_author
    });
    let response = send(
        env,
        discord_bot_principal,
        community_local_user_index,
        channel,
        renamed.clone(),
    );
    assert!(matches!(response, SendResponse::Success(_)), "{response:?}");
    wait_for_bridged_user(env, canister_ids.user_index, &renamed);

    // A bridge bot is refused once it's unset. Both are unset, which also leaves the pooled env as
    // it was
    for platform in [BridgePlatform::Discord, BridgePlatform::Telegram] {
        let response = set_bridge_bot(env, operator.principal, canister_ids.user_index, platform, None);
        assert!(matches!(response, UnitResult::Success), "{response:?}");
        wait_for_bridge_bot_everywhere(env, canister_ids, platform, None);
    }

    let response = send(env, discord_bot_principal, community_local_user_index, channel, from_discord);
    assert!(
        matches!(&response, SendResponse::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "{response:?}"
    );
}

// The UserIndex fans the bridge bots out to every LocalUserIndex, which can take a while under load
fn wait_for_bridge_bot_everywhere(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    platform: BridgePlatform,
    bot_id: Option<UserId>,
) {
    let expected = bot_id.map(|b| b.to_string());
    let local_user_indexes: Vec<_> = canister_ids.subnets.iter().map(|s| s.local_user_index).collect();
    let bridge_bot = |env: &PocketIc, canister_id: CanisterId| {
        try_metrics(env, canister_id)?["bridge_bots"][platform.to_string()]
            .as_str()
            .map(|b| b.to_string())
    };

    for _ in 0..50 {
        if local_user_indexes.iter().all(|c| bridge_bot(env, *c) == expected) {
            return;
        }
        env.tick();
    }

    let lagging: Vec<_> = local_user_indexes
        .into_iter()
        .filter(|c| bridge_bot(env, *c) != expected)
        .collect();
    panic!("LocalUserIndexes without the {platform} bridge bot {expected:?}: {lagging:?}");
}

fn set_bridge_bot(
    env: &mut PocketIc,
    operator: Principal,
    user_index: CanisterId,
    platform: BridgePlatform,
    bot_id: Option<UserId>,
) -> UnitResult {
    client::user_index::set_bridge_bot(
        env,
        operator,
        user_index,
        &user_index_canister::set_bridge_bot::Args { platform, bot_id },
    )
}

fn send(
    env: &mut PocketIc,
    bot_principal: Principal,
    local_user_index: CanisterId,
    chat: Chat,
    bridged_from: BridgedUser,
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
                text: "Hello from the other side".to_string(),
            }),
            block_level_markdown: false,
            finalised: true,
            og_previews: None,
            bridged_from: Some(bridged_from),
        },
    )
}

fn assert_relayed_from(events: &EventsResponse, bot_id: UserId, bridged_from: &BridgedUser) {
    let ChatEvent::Message(message) = &events.events[0].event else {
        panic!("Expected a message: {:?}", events.events[0].event);
    };
    assert_eq!(message.sender, bot_id);
    let Some(SenderContext::Bot(bot_context)) = &message.sender_context else {
        panic!("Expected a bot sender context: {:?}", message.sender_context);
    };
    assert_eq!(bot_context.bridged_from, Some(bridged_from.id()));
}

// The LocalUserIndex passes the profile on to the UserIndex over its event queue
fn wait_for_bridged_user(env: &mut PocketIc, user_index: CanisterId, user: &BridgedUser) {
    for _ in 0..50 {
        let user_index_canister::bridged_users::Response::Success(users) = client::user_index::bridged_users(
            env,
            Principal::anonymous(),
            user_index,
            &user_index_canister::bridged_users::Args { users: vec![user.id()] },
        );
        if users.first().map(|u| &u.user) == Some(user) {
            return;
        }
        env.tick();
    }
    panic!("The UserIndex doesn't have the profile {user:?}");
}
