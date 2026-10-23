use crate::bot_tests::register_bot;
use crate::env::ENV;
use crate::utils::{tick_many, try_metrics};
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use constants::{ICP_SYMBOL, ICP_TRANSFER_FEE};
use local_user_index_canister::bot_send_message::Response as SendResponse;
use multi_user_canister::MessageActivity;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::collections::HashSet;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::random_string;
use types::{
    BotChatContext, BotInstallationLocation, BotMessageContent, BotPermissions, BridgePlatform, BridgedUser, CanisterId, Chat,
    ChatEvent, DiscordUser, Empty, EventsResponse, MessageContent, MessageId, MessageIndex, MessagePermission,
    PendingCryptoTransaction, SenderContext, TelegramUser, TextContent, UnitResult, UserId, icrc1, icrc2,
};
use user_index_canister::link_bridged_user::Response as LinkResponse;
use user_index_canister::start_bridged_user_link::Response as StartLinkResponse;

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
        photo_id: Some("AQADtLwxG5a_QEZ-".to_string()),
    });

    // Relayed into a channel and into a group, each message keeps its author on the other platform
    let response = send(
        env,
        discord_bot_principal,
        community_local_user_index,
        channel,
        from_discord.clone(),
    );
    let SendResponse::Success(channel_message) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };
    let events = client::community::happy_path::events_by_index(
        env,
        &owner,
        community_id,
        channel_id,
        vec![channel_message.event_index],
    );
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
    let SendResponse::Success(group_message) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };
    let events = client::group::happy_path::events_by_index(env, &owner, group_id, vec![group_message.event_index]);
    assert_relayed_from(&events, discord_bot_id, &from_discord);

    let response = send(
        env,
        telegram_bot_principal,
        community_local_user_index,
        channel,
        from_telegram.clone(),
    );
    let SendResponse::Success(telegram_message) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };
    let events = client::community::happy_path::events_by_index(
        env,
        &owner,
        community_id,
        channel_id,
        vec![telegram_message.event_index],
    );
    assert_relayed_from(&events, telegram_bot_id, &from_telegram);
    wait_for_bridged_user(env, canister_ids.user_index, &from_telegram);

    // A bridge bot relays the edits made on the other platform to the messages it relayed
    let response = edit(
        env,
        discord_bot_principal,
        community_local_user_index,
        channel,
        channel_message.message_id,
        "Edited on Discord",
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    let events = client::community::happy_path::events_by_index(
        env,
        &owner,
        community_id,
        channel_id,
        vec![channel_message.event_index],
    );
    assert_edited_to(&events, "Edited on Discord");
    assert_relayed_from(&events, discord_bot_id, &from_discord);

    let response = edit(
        env,
        discord_bot_principal,
        group_local_user_index,
        group,
        group_message.message_id,
        "Edited on Discord",
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    let events = client::group::happy_path::events_by_index(env, &owner, group_id, vec![group_message.event_index]);
    assert_edited_to(&events, "Edited on Discord");
    assert_relayed_from(&events, discord_bot_id, &from_discord);

    // Including in a thread
    let response = send_in_thread(
        env,
        discord_bot_principal,
        community_local_user_index,
        channel,
        Some(channel_message.message_index),
        from_discord.clone(),
    );
    let SendResponse::Success(thread_message) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };
    let response = edit_in_thread(
        env,
        discord_bot_principal,
        community_local_user_index,
        channel,
        Some(channel_message.message_index),
        thread_message.message_id,
        "Edited in a thread on Discord",
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    let community_canister::events_by_index::Response::Success(events) = client::community::events_by_index(
        env,
        owner.principal,
        community_id.into(),
        &community_canister::events_by_index::Args {
            channel_id,
            thread_root_message_index: Some(channel_message.message_index),
            events: vec![thread_message.event_index],
            latest_known_update: None,
        },
    ) else {
        panic!("'events_by_index' failed");
    };
    assert_edited_to(&events, "Edited in a thread on Discord");

    // But not a message another bot sent
    let response = edit(
        env,
        telegram_bot_principal,
        community_local_user_index,
        channel,
        channel_message.message_id,
        "Edited on Telegram",
    );
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "{response:?}"
    );
    let events = client::community::happy_path::events_by_index(
        env,
        &owner,
        community_id,
        channel_id,
        vec![channel_message.event_index],
    );
    assert_edited_to(&events, "Edited on Discord");

    // Nor content a message couldn't be sent with
    let response = edit(
        env,
        discord_bot_principal,
        community_local_user_index,
        channel,
        channel_message.message_id,
        &"a".repeat(10_001),
    );
    assert!(matches!(response, UnitResult::Error(_)), "{response:?}");

    // Nor a message which has been deleted, since its content wouldn't be moderated again
    let response = client::community::delete_messages(
        env,
        owner.principal,
        community_id.into(),
        &community_canister::delete_messages::Args {
            channel_id,
            thread_root_message_index: None,
            message_ids: vec![telegram_message.message_id],
            as_platform_moderator: None,
            new_achievement: false,
        },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    let response = edit(
        env,
        telegram_bot_principal,
        community_local_user_index,
        channel,
        telegram_message.message_id,
        "Edited on Telegram",
    );
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::MessageNotFound)),
        "{response:?}"
    );

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

    // An OpenChat user links their Discord account from their profile. OpenChat gives them a code,
    // which the bridge bot redeems once it knows whose account it is, eg. through Discord's OAuth.
    let user_index = canister_ids.user_index;
    let code = start_link(env, owner.principal, user_index, BridgePlatform::Discord);
    // The UserIndex tells every LocalUserIndex who each account is linked to
    let links_before = bridged_user_links(env, canister_ids);

    // Only the platform's bridge bot can redeem it
    for (principal, user) in [
        (discord_bot_principal, from_telegram.clone()),
        (owner.principal, renamed.clone()),
    ] {
        let response = link(env, principal, user_index, user, &code);
        assert!(
            matches!(&response, LinkResponse::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
            "{response:?}"
        );
    }

    // And only for an account on that platform, without using it up
    let response = link(env, telegram_bot_principal, user_index, from_telegram.clone(), &code);
    assert!(
        matches!(&response, LinkResponse::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "{response:?}"
    );

    let response = link(env, discord_bot_principal, user_index, renamed.clone(), &code);
    assert!(
        matches!(&response, LinkResponse::Success(r) if r.user_id == owner.user_id && !r.username.is_empty()),
        "{response:?}"
    );
    assert_eq!(linked_user_id(env, user_index, &renamed), Some(owner.user_id));
    wait_for_bridged_user_links(env, canister_ids, &links_before, 1);
    let user_index_canister::linked_bridged_users::Response::Success(linked) =
        client::user_index::linked_bridged_users(env, owner.principal, user_index, &Empty {});
    assert_eq!(linked.iter().map(|u| &u.user).collect::<Vec<_>>(), vec![&renamed]);

    // The code can only be used once
    let response = link(env, discord_bot_principal, user_index, renamed.clone(), &code);
    assert!(
        matches!(&response, LinkResponse::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "{response:?}"
    );

    // A user can link one account per platform, so while their Discord account is linked they
    // can't start linking another, but they can link a Telegram account
    let response = client::user_index::start_bridged_user_link(
        env,
        owner.principal,
        user_index,
        &user_index_canister::start_bridged_user_link::Args {
            platform: BridgePlatform::Discord,
        },
    );
    assert!(
        matches!(&response, StartLinkResponse::Error(e) if e.matches_code(OCErrorCode::AlreadyAdded)),
        "{response:?}"
    );
    let code = start_link(env, owner.principal, user_index, BridgePlatform::Telegram);
    let response = link(env, telegram_bot_principal, user_index, from_telegram.clone(), &code);
    assert!(matches!(response, LinkResponse::Success(_)), "{response:?}");
    wait_for_bridged_user_links(env, canister_ids, &links_before, 2);
    let user_index_canister::linked_bridged_users::Response::Success(linked) =
        client::user_index::linked_bridged_users(env, owner.principal, user_index, &Empty {});
    let mut linked: Vec<_> = linked.into_iter().map(|u| u.user.id()).collect();
    linked.sort();
    let mut expected = vec![renamed.id(), from_telegram.id()];
    expected.sort();
    assert_eq!(linked, expected);

    // The user can unlink it from their profile
    let response = unlink(env, owner.principal, user_index, &renamed);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    assert_eq!(linked_user_id(env, user_index, &renamed), None);
    wait_for_bridged_user_links(env, canister_ids, &links_before, 1);

    // So can the account's owner on the other platform, which the bridge bot relays, from whoever
    // it's linked to. Only the platform's bridge bot can.
    let code = start_link(env, owner.principal, user_index, BridgePlatform::Discord);
    let response = link(env, discord_bot_principal, user_index, renamed.clone(), &code);
    assert!(matches!(response, LinkResponse::Success(_)), "{response:?}");
    // Before the bot unlinks it, so the count going back down is the bot's unlink arriving
    wait_for_bridged_user_links(env, canister_ids, &links_before, 2);
    let response = unlink(env, telegram_bot_principal, user_index, &renamed);
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "{response:?}"
    );
    assert_eq!(linked_user_id(env, user_index, &renamed), Some(owner.user_id));
    let response = unlink(env, discord_bot_principal, user_index, &renamed);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    assert_eq!(linked_user_id(env, user_index, &renamed), None);
    wait_for_bridged_user_links(env, canister_ids, &links_before, 1);

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

    // Nor can a user start linking an account on a platform with no bridge bot
    let response = client::user_index::start_bridged_user_link(
        env,
        owner.principal,
        user_index,
        &user_index_canister::start_bridged_user_link::Args {
            platform: BridgePlatform::Discord,
        },
    );
    assert!(
        matches!(&response, StartLinkResponse::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "{response:?}"
    );

    let response = edit(
        env,
        discord_bot_principal,
        community_local_user_index,
        channel,
        channel_message.message_id,
        "Edited again",
    );
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
        "{response:?}"
    );
}

// A relayed message's tips go to the OpenChat user who linked the account it came from, and only if
// they're in the chat
#[test_case(true; "in a channel")]
#[test_case(false; "in a group")]
fn tips_on_relayed_messages_go_to_whoever_linked_the_account(in_community: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let tipper = client::register_user(env, canister_ids);
    let outsider = client::register_user(env, canister_ids);
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, &tipper, 10_000_000_000);
    let (chat, location, spender): (Chat, BotInstallationLocation, CanisterId) = if in_community {
        let community_id =
            client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);
        let channel_id =
            client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
        client::community::happy_path::join_channel(env, tipper.principal, community_id, channel_id);
        (
            Chat::Channel(community_id, channel_id),
            BotInstallationLocation::Community(community_id),
            community_id.into(),
        )
    } else {
        let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
        client::group::happy_path::join_group(env, tipper.principal, group_id);
        (
            Chat::Group(group_id),
            BotInstallationLocation::Group(group_id),
            group_id.into(),
        )
    };
    let local_user_index = canister_ids.local_user_index(env, spender);
    let user_index = canister_ids.user_index;

    let (bot_id, bot_principal) = register_bot(env, &owner, user_index, random_string(), random_string());
    let permissions = BotPermissions::default().with_message(&HashSet::from_iter([MessagePermission::Text]));
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        location,
        bot_id,
        permissions.clone(),
        Some(permissions),
    );
    let operator = client::register_user(env, canister_ids);
    client::user_index::happy_path::add_platform_operator(env, *controller, user_index, operator.user_id);
    tick_many(env, 3);
    let response = set_bridge_bot(env, operator.principal, user_index, BridgePlatform::Telegram, Some(bot_id));
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    wait_for_bridge_bot_everywhere(env, canister_ids, BridgePlatform::Telegram, Some(bot_id));

    let telegram_account = |id| {
        BridgedUser::Telegram(TelegramUser {
            id,
            username: None,
            display_name: random_string(),
            photo_id: None,
        })
    };
    let owners_account = telegram_account(223344556);
    let outsiders_account = telegram_account(334455667);
    let relay = |env: &mut PocketIc, from: &BridgedUser| match send(env, bot_principal, local_user_index, chat, from.clone()) {
        SendResponse::Success(result) => (result.message_id, result.event_index),
        response => panic!("{response:?}"),
    };
    let tip_amount = 1_0000_0000;

    // No one has linked the account, so there's no one to tip
    let (message_id, event_index) = relay(env, &owners_account);
    let response = tip(
        env,
        &tipper,
        chat,
        message_id,
        owner.user_id,
        canister_ids.icp_ledger,
        tip_amount,
    );
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::TargetUserNotFound)),
        "{response:?}"
    );

    let links_before = bridged_user_links(env, canister_ids);
    let code = start_link(env, owner.principal, user_index, BridgePlatform::Telegram);
    let response = link(env, bot_principal, user_index, owners_account.clone(), &code);
    assert!(matches!(response, LinkResponse::Success(_)), "{response:?}");
    wait_for_bridged_user_links(env, canister_ids, &links_before, 1);

    // Once it's linked, its tips go to whoever linked it
    let owners_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &owner);
    client::approve_spender(env, &tipper, canister_ids.icp_ledger, spender, tip_amount + ICP_TRANSFER_FEE);
    let response = tip(
        env,
        &tipper,
        chat,
        message_id,
        owner.user_id,
        canister_ids.icp_ledger,
        tip_amount,
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &owner),
        owners_balance + tip_amount
    );
    let events = match chat {
        Chat::Channel(community_id, channel_id) => {
            client::community::happy_path::events_by_index(env, &owner, community_id, channel_id, vec![event_index])
        }
        Chat::Group(group_id) => client::group::happy_path::events_by_index(env, &owner, group_id, vec![event_index]),
        Chat::Direct(_) => unreachable!(),
    };
    let message = events
        .events
        .into_iter()
        .next()
        .map(|e| if let ChatEvent::Message(m) = e.event { *m } else { panic!() })
        .unwrap();
    assert_eq!(message.tips.len(), 1);
    assert_eq!(
        *message.tips.first().unwrap(),
        (canister_ids.icp_ledger, vec![(tipper.user_id, tip_amount)])
    );

    // And so does the activity, which before went nowhere, as the message's sender is a bot
    let tipped = |env: &PocketIc| {
        client::user::happy_path::message_activity_feed(env, &owner, 0)
            .events
            .iter()
            .any(|e| e.activity == MessageActivity::Tip && e.message_id == message_id && e.user_id == Some(tipper.user_id))
    };
    for _ in 0..20 {
        if tipped(env) {
            break;
        }
        env.tick();
    }
    assert!(
        tipped(env),
        "the tip never reached the activity feed of whoever linked the account"
    );

    // Who linked it can't tip it, as it's shown as theirs
    let response = tip(
        env,
        &owner,
        chat,
        message_id,
        owner.user_id,
        canister_ids.icp_ledger,
        tip_amount,
    );
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::CannotTipSelf)),
        "{response:?}"
    );

    // Nor can a message be tipped if whoever linked its account isn't in the chat
    let code = start_link(env, outsider.principal, user_index, BridgePlatform::Telegram);
    let response = link(env, bot_principal, user_index, outsiders_account.clone(), &code);
    assert!(matches!(response, LinkResponse::Success(_)), "{response:?}");
    wait_for_bridged_user_links(env, canister_ids, &links_before, 2);
    let (message_id, _) = relay(env, &outsiders_account);
    let response = tip(
        env,
        &tipper,
        chat,
        message_id,
        outsider.user_id,
        canister_ids.icp_ledger,
        tip_amount,
    );
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::TargetUserNotInChat)),
        "{response:?}"
    );

    // Leaves the pooled env as it was
    for account in [&owners_account, &outsiders_account] {
        let response = unlink(env, bot_principal, user_index, account);
        assert!(matches!(response, UnitResult::Success), "{response:?}");
    }
    let response = set_bridge_bot(env, operator.principal, user_index, BridgePlatform::Telegram, None);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    wait_for_bridge_bot_everywhere(env, canister_ids, BridgePlatform::Telegram, None);
}

// Tips a group or channel message, addressing the transfer to `recipient`, without approving it
// first, so a tip refused before its transfer needs no funds
fn tip(
    env: &mut PocketIc,
    tipper: &User,
    chat: Chat,
    message_id: MessageId,
    recipient: UserId,
    ledger: CanisterId,
    amount: u128,
) -> UnitResult {
    let transfer = PendingCryptoTransaction::ICRC2(icrc2::PendingCryptoTransaction {
        ledger,
        token_symbol: ICP_SYMBOL.to_string(),
        amount,
        from: tipper.principal.into(),
        to: icrc1::Account::legacy_for_user(recipient),
        fee: ICP_TRANSFER_FEE,
        memo: None,
        created: env.get_time().as_nanos_since_unix_epoch(),
    });
    match chat {
        Chat::Channel(community_id, channel_id) => client::community::tip_message(
            env,
            tipper.principal,
            community_id.into(),
            &community_canister::tip_message::Args {
                channel_id,
                thread_root_message_index: None,
                message_id,
                transfer,
                decimals: 8,
                username: tipper.username(),
                display_name: None,
                new_achievement: false,
            },
        ),
        Chat::Group(group_id) => client::group::tip_message(
            env,
            tipper.principal,
            group_id.into(),
            &group_canister::tip_message::Args {
                thread_root_message_index: None,
                message_id,
                transfer,
                decimals: 8,
                username: tipper.username(),
                display_name: None,
                new_achievement: false,
            },
        ),
        Chat::Direct(_) => unreachable!(),
    }
}

fn edit(
    env: &mut PocketIc,
    bot_principal: Principal,
    local_user_index: CanisterId,
    chat: Chat,
    message_id: MessageId,
    text: &str,
) -> UnitResult {
    edit_in_thread(env, bot_principal, local_user_index, chat, None, message_id, text)
}

fn edit_in_thread(
    env: &mut PocketIc,
    bot_principal: Principal,
    local_user_index: CanisterId,
    chat: Chat,
    thread: Option<MessageIndex>,
    message_id: MessageId,
    text: &str,
) -> UnitResult {
    client::local_user_index::bot_edit_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_edit_message::Args {
            chat_context: BotChatContext::Autonomous(chat),
            thread,
            message_id,
            content: BotMessageContent::Text(TextContent { text: text.to_string() }),
            block_level_markdown: false,
            og_previews: None,
        },
    )
}

fn assert_edited_to(events: &EventsResponse, text: &str) {
    let ChatEvent::Message(message) = &events.events[0].event else {
        panic!("Expected a message: {:?}", events.events[0].event);
    };
    assert!(
        matches!(&message.content, MessageContent::Text(t) if t.text == text),
        "{:?}",
        message.content
    );
    assert!(message.edited);
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

// Each LocalUserIndex's count of linked accounts
fn bridged_user_links(env: &PocketIc, canister_ids: &CanisterIds) -> Vec<(CanisterId, u64)> {
    canister_ids
        .subnets
        .iter()
        .map(|s| {
            let count = try_metrics(env, s.local_user_index).and_then(|m| m["bridged_user_links"].as_u64());
            (s.local_user_index, count.unwrap_or_default())
        })
        .collect()
}

// Ticks until each LocalUserIndex knows of `added` more linked accounts than it did `before`
fn wait_for_bridged_user_links(env: &mut PocketIc, canister_ids: &CanisterIds, before: &[(CanisterId, u64)], added: u64) {
    let expected: Vec<_> = before.iter().map(|(c, count)| (*c, count + added)).collect();
    for _ in 0..50 {
        if bridged_user_links(env, canister_ids) == expected {
            return;
        }
        env.tick();
    }
    panic!(
        "The LocalUserIndexes know of {:?} linked accounts, rather than {expected:?}",
        bridged_user_links(env, canister_ids)
    );
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
    send_in_thread(env, bot_principal, local_user_index, chat, None, bridged_from)
}

fn send_in_thread(
    env: &mut PocketIc,
    bot_principal: Principal,
    local_user_index: CanisterId,
    chat: Chat,
    thread: Option<MessageIndex>,
    bridged_from: BridgedUser,
) -> SendResponse {
    client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Autonomous(chat),
            thread,
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

fn start_link(env: &mut PocketIc, user: Principal, user_index: CanisterId, platform: BridgePlatform) -> String {
    match client::user_index::start_bridged_user_link(
        env,
        user,
        user_index,
        &user_index_canister::start_bridged_user_link::Args { platform },
    ) {
        StartLinkResponse::Success(result) => result.code,
        response => panic!("'start_bridged_user_link' error: {response:?}"),
    }
}

fn link(env: &mut PocketIc, caller: Principal, user_index: CanisterId, user: BridgedUser, code: &str) -> LinkResponse {
    client::user_index::link_bridged_user(
        env,
        caller,
        user_index,
        &user_index_canister::link_bridged_user::Args {
            user,
            code: code.to_string(),
        },
    )
}

fn unlink(env: &mut PocketIc, caller: Principal, user_index: CanisterId, user: &BridgedUser) -> UnitResult {
    client::user_index::unlink_bridged_user(
        env,
        caller,
        user_index,
        &user_index_canister::unlink_bridged_user::Args { user: user.id() },
    )
}

fn linked_user_id(env: &PocketIc, user_index: CanisterId, user: &BridgedUser) -> Option<UserId> {
    let user_index_canister::bridged_users::Response::Success(users) = client::user_index::bridged_users(
        env,
        Principal::anonymous(),
        user_index,
        &user_index_canister::bridged_users::Args { users: vec![user.id()] },
    );
    users.first().and_then(|u| u.linked_user_id)
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
