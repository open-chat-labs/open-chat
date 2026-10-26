use crate::bot_tests::{default_bot_definition, register_bot};
use crate::env::ENV;
use crate::setup::install_icrc_ledger;
use crate::utils::{now_millis, tick_many, try_metrics};
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use constants::{DAY_IN_MS, ICP_SYMBOL, ICP_TRANSFER_FEE, OPENCHAT_BOT_USER_ID};
use local_user_index_canister::bot_send_message::Response as SendResponse;
use multi_user_canister::MessageActivity;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::collections::HashSet;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_from_u32, random_from_u128, random_string};
use types::{
    BotChatContext, BotChatEvent, BotDataEncoding, BotEvent, BotEventWrapper, BotInstallationLocation, BotMessageContent,
    BotMessageTip, BotPermissions, BotSubscriptions, BridgePlatform, BridgedUser, CanisterId, Chat, ChatEvent, ChatEventType,
    ChatPermission, DiscordUser, Empty, EventIndex, EventsResponse, GroupReplyContext, IdempotentEnvelope, MessageContent,
    MessageContentInitial, MessageId, MessageIndex, MessagePermission, NotificationEnvelope, PendingCryptoTransaction,
    SenderContext, SuccessOnly, TelegramUser, TextContent, TwitchUser, UnitResult, UserId, icrc1, icrc2,
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
        bot: false,
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
            bot: false,
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
    let tipper = client::register_user(env, canister_ids);
    let outsider = client::register_user(env, canister_ids);
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, &tipper, 10_000_000_000);
    let bridged = set_up_bridged_chat(
        env,
        canister_ids,
        *controller,
        BridgePlatform::Telegram,
        in_community,
        &[&tipper],
    );
    let owner = &bridged.owner;
    let (chat, spender) = (bridged.chat, bridged.spender);
    let user_index = canister_ids.user_index;

    let owners_account = telegram_account(random_telegram_id());
    let outsiders_account = telegram_account(random_telegram_id());
    let tip_amount = 1_0000_0000;

    let links_before = bridged_user_links(env, canister_ids);
    let code = start_link(env, owner.principal, user_index, BridgePlatform::Telegram);
    let response = link(env, bridged.bot_principal, user_index, owners_account.clone(), &code);
    assert!(matches!(response, LinkResponse::Success(_)), "{response:?}");
    wait_for_bridged_user_links(env, canister_ids, &links_before, 1);

    // A linked account's tips go to whoever linked it
    let (message_id, event_index) = relay(env, &bridged, &owners_account);
    let owners_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, owner);
    let notifications_from = next_notification_index(env, *controller, &bridged);
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
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, owner),
        owners_balance + tip_amount
    );
    assert_tipped(
        env,
        owner,
        chat,
        event_index,
        tipper.user_id,
        canister_ids.icp_ledger,
        tip_amount,
    );
    // The bridge bot is told of the tip, but that it isn't held, so it doesn't tell the account
    let notified = wait_for_tip_notified(env, *controller, &bridged, notifications_from, message_id);
    assert_eq!(notified.held_for, None);

    // And so does the activity, which before went nowhere, as the message's sender is a bot
    let tipped = |env: &PocketIc| {
        client::user::happy_path::message_activity_feed(env, owner, 0)
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
        owner,
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
    let response = link(env, bridged.bot_principal, user_index, outsiders_account.clone(), &code);
    assert!(matches!(response, LinkResponse::Success(_)), "{response:?}");
    wait_for_bridged_user_links(env, canister_ids, &links_before, 2);
    let (message_id, _) = relay(env, &bridged, &outsiders_account);
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
        let response = unlink(env, bridged.bot_principal, user_index, account);
        assert!(matches!(response, UnitResult::Success), "{response:?}");
    }
    clear_bridge_bot(env, canister_ids, &bridged);
}

// A tip on a message from an account no one has linked is held for it by the UserIndex, then paid
// to whoever links the account, or else refunded after 30 days, less the fee each time
#[test_case(true; "in a channel")]
#[test_case(false; "in a group")]
fn tips_for_unlinked_accounts_are_held_for_whoever_links_them(in_community: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let tipper = client::register_user(env, canister_ids);
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, &tipper, 10_000_000_000);
    let bridged = set_up_bridged_chat(
        env,
        canister_ids,
        *controller,
        BridgePlatform::Telegram,
        in_community,
        &[&tipper],
    );
    let (chat, spender) = (bridged.chat, bridged.spender);
    let (user_index, ledger) = (canister_ids.user_index, canister_ids.icp_ledger);
    let tip_amount = 1_0000_0000;
    let balance = |env: &PocketIc, account: icrc1::Account| client::ledger::happy_path::balance_of(env, ledger, account);
    let held_for = |account: &BridgedUser| icrc1::Account {
        owner: user_index,
        subaccount: Some(account.id().subaccount()),
    };

    // The tip is paid into the UserIndex, and recorded on the message
    let nellys_account = telegram_account(random_telegram_id());
    let (message_id, event_index) = relay(env, &bridged, &nellys_account);
    let held_before = bridged_user_deposits_held(env, user_index);
    let notifications_from = next_notification_index(env, *controller, &bridged);
    client::approve_spender(env, &tipper, ledger, spender, tip_amount + ICP_TRANSFER_FEE);
    let response = tip_to(env, &tipper, chat, message_id, held_for(&nellys_account), ledger, tip_amount);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    assert_eq!(balance(env, held_for(&nellys_account)), tip_amount);
    assert_tipped(env, &bridged.owner, chat, event_index, tipper.user_id, ledger, tip_amount);
    wait_until(env, "the tip to be held", |env| {
        bridged_user_deposits_held(env, user_index) == held_before + 1
    });

    // The bridge bot is told of the tip, and that it's held for the account, so it can tell the
    // account's owner how to claim it
    assert_eq!(
        wait_for_tip_notified(env, *controller, &bridged, notifications_from, message_id),
        BotMessageTip {
            tipped_by: tipper.user_id,
            ledger,
            token_symbol: ICP_SYMBOL.to_string(),
            amount: tip_amount,
            held_for: Some(nellys_account.id()),
        }
    );

    // Whoever links the account is paid it, and told so by the OpenChat bot
    let nelly = client::register_user(env, canister_ids);
    let code = start_link(env, nelly.principal, user_index, BridgePlatform::Telegram);
    let response = link(env, bridged.bot_principal, user_index, nellys_account.clone(), &code);
    assert!(matches!(response, LinkResponse::Success(_)), "{response:?}");
    wait_until(env, "the tip to be paid", |env| {
        balance(env, nelly.principal.into()) == tip_amount - ICP_TRANSFER_FEE
    });
    assert_eq!(balance(env, held_for(&nellys_account)), 0);
    assert_eq!(bridged_user_deposits_held(env, user_index), held_before);
    wait_until(env, "the OpenChat bot to say what was paid", |env| {
        openchat_bot_texts(env, &nelly)
            .iter()
            .any(|text| text == "Tips held for your Telegram account have been sent to your wallet:\n- 0.9999 ICP")
    });

    // A tip no one claims is refunded to the account it came from, after 30 days. One which isn't
    // more than the fee can't be held, as it couldn't be paid out.
    let bobs_account = telegram_account(random_telegram_id());
    let (message_id, _) = relay(env, &bridged, &bobs_account);
    let response = tip_to(
        env,
        &tipper,
        chat,
        message_id,
        held_for(&bobs_account),
        ledger,
        ICP_TRANSFER_FEE,
    );
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "{response:?}"
    );
    client::approve_spender(env, &tipper, ledger, spender, tip_amount + ICP_TRANSFER_FEE);
    let response = tip_to(env, &tipper, chat, message_id, held_for(&bobs_account), ledger, tip_amount);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    let tippers_balance = balance(env, tipper.principal.into());
    wait_until(env, "the tip to be held", |env| {
        bridged_user_deposits_held(env, user_index) == held_before + 1
    });
    env.advance_time(Duration::from_millis(29 * DAY_IN_MS));
    // Enough for a refund which was due to be paid: its timer job, the payment's, and the transfer
    tick_many(env, 10);
    assert_eq!(balance(env, tipper.principal.into()), tippers_balance);
    env.advance_time(Duration::from_millis(DAY_IN_MS));
    wait_until(env, "the tip to be refunded", |env| {
        balance(env, tipper.principal.into()) == tippers_balance + tip_amount - ICP_TRANSFER_FEE
    });
    assert_eq!(balance(env, held_for(&bobs_account)), 0);

    // No one can link a Telegram chat, so its messages can't be tipped
    let channels_account = telegram_account(-1001234567890);
    let (message_id, _) = relay(env, &bridged, &channels_account);
    let response = tip_to(
        env,
        &tipper,
        chat,
        message_id,
        held_for(&channels_account),
        ledger,
        tip_amount,
    );
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::TargetUserNotFound)),
        "{response:?}"
    );

    // Leaves the pooled env as it was
    let response = unlink(env, bridged.bot_principal, user_index, &nellys_account);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    clear_bridge_bot(env, canister_ids, &bridged);
}

// A tip which reaches the UserIndex after someone has linked its account, eg. as the group's
// LocalUserIndex hadn't heard of the link yet, is paid on to them at once
#[test]
fn a_tip_held_for_an_account_linked_since_is_paid_on_at_once() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let tipper = client::register_user(env, canister_ids);
    let bridged = set_up_bridged_chat(env, canister_ids, *controller, BridgePlatform::Telegram, false, &[&tipper]);
    let Chat::Group(group_id) = bridged.chat else { unreachable!() };
    let (user_index, ledger) = (canister_ids.user_index, canister_ids.icp_ledger);
    let tip_amount = 1_0000_0000;

    let nelly = client::register_user(env, canister_ids);
    let nellys_account = telegram_account(random_telegram_id());
    let code = start_link(env, nelly.principal, user_index, BridgePlatform::Telegram);
    let response = link(env, bridged.bot_principal, user_index, nellys_account.clone(), &code);
    assert!(matches!(response, LinkResponse::Success(_)), "{response:?}");

    // The group pays the tip into the UserIndex, then tells it, as if it hadn't heard of the link
    let held_for = icrc1::Account {
        owner: user_index,
        subaccount: Some(nellys_account.id().subaccount()),
    };
    client::ledger::happy_path::transfer(env, *controller, ledger, held_for, tip_amount);
    let response = client::local_user_index::c2c_group(
        env,
        group_id.into(),
        bridged.local_user_index,
        &local_user_index_canister::c2c_group::Args {
            events: vec![IdempotentEnvelope {
                created_at: now_millis(env),
                idempotency_id: random_from_u128::<u128>() as u64,
                value: local_user_index_canister::GroupOrCommunityEvent::BridgedUserDeposit(Box::new(
                    local_user_index_canister::BridgedUserDeposit {
                        channel_id: None,
                        thread_root_message_index: None,
                        message_id: random_from_u128(),
                        account: nellys_account.id(),
                        sender: tipper.user_id,
                        refund_to: tipper.principal.into(),
                        ledger,
                        token_symbol: ICP_SYMBOL.to_string(),
                        amount: tip_amount,
                        fee: ICP_TRANSFER_FEE,
                        decimals: 8,
                    },
                )),
            }],
        },
    );
    assert!(matches!(response, SuccessOnly::Success), "{response:?}");

    wait_until(env, "the tip to be paid on", |env| {
        client::ledger::happy_path::balance_of(env, ledger, &nelly) == tip_amount - ICP_TRANSFER_FEE
    });
    assert_eq!(client::ledger::happy_path::balance_of(env, ledger, held_for), 0);
    wait_until(env, "the OpenChat bot to say what was paid", |env| {
        openchat_bot_texts(env, &nelly)
            .iter()
            .any(|text| text == "Tips held for your Telegram account have been sent to your wallet:\n- 0.9999 ICP")
    });

    // Leaves the pooled env as it was
    let response = unlink(env, bridged.bot_principal, user_index, &nellys_account);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    clear_bridge_bot(env, canister_ids, &bridged);
}

// Only tips in tokens the UserIndex knows, from the Registry, are paid out, as a "ledger" which a
// tipper names could be a canister which never replies. Such a tip is held, but neither claimed nor
// refunded.
#[test]
fn tips_held_in_ledgers_the_registry_doesnt_know_arent_paid_out() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let tipper = client::register_user(env, canister_ids);
    let bridged = set_up_bridged_chat(env, canister_ids, *controller, BridgePlatform::Telegram, false, &[&tipper]);
    let user_index = canister_ids.user_index;
    let tip_amount = 1_0000_0000;
    let ledger = install_icrc_ledger(
        env,
        *controller,
        random_string(),
        random_string(),
        ICP_TRANSFER_FEE as u64,
        None,
        vec![(tipper.principal.into(), 10_000_000_000)],
    );
    let balance = |env: &PocketIc, account: icrc1::Account| client::ledger::happy_path::balance_of(env, ledger, account);

    let nellys_account = telegram_account(random_telegram_id());
    let held_for = icrc1::Account {
        owner: user_index,
        subaccount: Some(nellys_account.id().subaccount()),
    };
    let (message_id, _) = relay(env, &bridged, &nellys_account);
    let held_before = bridged_user_deposits_held(env, user_index);
    client::approve_spender(env, &tipper, ledger, bridged.spender, tip_amount + ICP_TRANSFER_FEE);
    let response = tip_to(env, &tipper, bridged.chat, message_id, held_for, ledger, tip_amount);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    wait_until(env, "the tip to be held", |env| {
        bridged_user_deposits_held(env, user_index) == held_before + 1
    });
    let tippers_balance = balance(env, tipper.principal.into());

    // Whoever links the account isn't paid it
    let nelly = client::register_user(env, canister_ids);
    let code = start_link(env, nelly.principal, user_index, BridgePlatform::Telegram);
    let response = link(env, bridged.bot_principal, user_index, nellys_account.clone(), &code);
    assert!(matches!(response, LinkResponse::Success(_)), "{response:?}");
    // As long as the OpenChat bot's message is waited for where it's sent
    tick_many(env, 30);
    assert_eq!(balance(env, nelly.principal.into()), 0);
    assert!(
        !openchat_bot_texts(env, &nelly)
            .iter()
            .any(|text| text.starts_with("Tips held for"))
    );

    // Nor is it refunded
    env.advance_time(Duration::from_millis(30 * DAY_IN_MS));
    tick_many(env, 10);
    assert_eq!(balance(env, nelly.principal.into()), 0);
    assert_eq!(balance(env, tipper.principal.into()), tippers_balance);
    assert_eq!(balance(env, held_for), tip_amount);

    // Leaves the pooled env as it was
    let response = unlink(env, bridged.bot_principal, user_index, &nellys_account);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    clear_bridge_bot(env, canister_ids, &bridged);
}

// No one can link a Discord bot or webhook, so a tip on one of their messages is refused, rather
// than held for 30 days and then refunded
#[test_case(true; "in a channel")]
#[test_case(false; "in a group")]
fn messages_from_discord_bots_cant_be_tipped(in_community: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let tipper = client::register_user(env, canister_ids);
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, &tipper, 10_000_000_000);
    let bridged = set_up_bridged_chat(
        env,
        canister_ids,
        *controller,
        BridgePlatform::Discord,
        in_community,
        &[&tipper],
    );
    let ledger = canister_ids.icp_ledger;
    let tip_amount = 1_0000_0000;
    let discord_account = |bot| {
        BridgedUser::Discord(DiscordUser {
            id: random_from_u128::<u128>() as u64,
            username: random_string(),
            display_name: None,
            avatar: None,
            bot,
        })
    };
    let held_for = |account: &BridgedUser| icrc1::Account {
        owner: canister_ids.user_index,
        subaccount: Some(account.id().subaccount()),
    };

    let bots_account = discord_account(true);
    let (message_id, _) = relay(env, &bridged, &bots_account);
    let response = tip_to(
        env,
        &tipper,
        bridged.chat,
        message_id,
        held_for(&bots_account),
        ledger,
        tip_amount,
    );
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::TargetUserNotFound)),
        "{response:?}"
    );

    // A Discord user's message can still be tipped, the tip being held for whoever links them
    let users_account = discord_account(false);
    let (message_id, _) = relay(env, &bridged, &users_account);
    client::approve_spender(env, &tipper, ledger, bridged.spender, tip_amount + ICP_TRANSFER_FEE);
    let response = tip_to(
        env,
        &tipper,
        bridged.chat,
        message_id,
        held_for(&users_account),
        ledger,
        tip_amount,
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");

    // Leaves the pooled env as it was
    clear_bridge_bot(env, canister_ids, &bridged);
}

// The UserIndex refreshes the tokens it pays held tips out of from the Registry daily
#[test]
fn user_index_refreshes_the_registrys_tokens_daily() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    env.advance_time(Duration::from_millis(DAY_IN_MS));
    wait_until(env, "the tokens to be refreshed", |env| {
        try_metrics(env, canister_ids.user_index)
            .and_then(|metrics| metrics["registry_tokens"].as_u64())
            .is_some_and(|tokens| tokens > 0)
    });
}

// A group, or a channel in a community, with a bridge bot for `platform` installed, and `members` in it
struct BridgedChat {
    owner: User,
    chat: Chat,
    // The group or community, which pulls the tips given in the chat
    spender: CanisterId,
    local_user_index: CanisterId,
    bot_id: UserId,
    bot_principal: Principal,
    // The platform operator who set the bridge bot
    operator: User,
    platform: BridgePlatform,
}

fn set_up_bridged_chat(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    controller: Principal,
    platform: BridgePlatform,
    in_community: bool,
    members: &[&User],
) -> BridgedChat {
    let owner = client::register_diamond_user(env, canister_ids, controller);
    let (chat, location, spender): (Chat, BotInstallationLocation, CanisterId) = if in_community {
        let community_id =
            client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);
        let channel_id =
            client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
        for member in members {
            client::community::happy_path::join_channel(env, member.principal, community_id, channel_id);
        }
        (
            Chat::Channel(community_id, channel_id),
            BotInstallationLocation::Community(community_id),
            community_id.into(),
        )
    } else {
        let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
        for member in members {
            client::group::happy_path::join_group(env, member.principal, group_id);
        }
        (
            Chat::Group(group_id),
            BotInstallationLocation::Group(group_id),
            group_id.into(),
        )
    };
    let local_user_index = canister_ids.local_user_index(env, spender);
    let user_index = canister_ids.user_index;

    // Subscribed to what the bridges are, eg. tips, so a tip's author can be told of it
    let mut definition = default_bot_definition(random_string());
    definition.default_subscriptions = Some(BotSubscriptions {
        community: HashSet::new(),
        chat: HashSet::from_iter([
            ChatEventType::Message,
            ChatEventType::MessageEdited,
            ChatEventType::MessageDeleted,
            ChatEventType::MessageTipped,
        ]),
    });
    let (bot_id, bot_principal) = client::user_index::happy_path::register_bot(
        env,
        owner.principal,
        user_index,
        random_string(),
        "https://my.bot.xyz/".to_string(),
        definition,
    );
    let permissions = BotPermissions::default().with_message(&HashSet::from_iter([MessagePermission::Text]));
    let autonomous_permissions = permissions
        .clone()
        .with_chat(&HashSet::from_iter([ChatPermission::ReadMessages]));
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        location,
        bot_id,
        permissions,
        Some(autonomous_permissions),
    );
    let operator = client::register_user(env, canister_ids);
    client::user_index::happy_path::add_platform_operator(env, controller, user_index, operator.user_id);
    tick_many(env, 3);
    let response = set_bridge_bot(env, operator.principal, user_index, platform, Some(bot_id));
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    wait_for_bridge_bot_everywhere(env, canister_ids, platform, Some(bot_id));

    BridgedChat {
        owner,
        chat,
        spender,
        local_user_index,
        bot_id,
        bot_principal,
        operator,
        platform,
    }
}

// Leaves the pooled env without a bridge bot for the platform, as it was
fn clear_bridge_bot(env: &mut PocketIc, canister_ids: &CanisterIds, bridged: &BridgedChat) {
    let response = set_bridge_bot(
        env,
        bridged.operator.principal,
        canister_ids.user_index,
        bridged.platform,
        None,
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    wait_for_bridge_bot_everywhere(env, canister_ids, bridged.platform, None);
}

fn telegram_account(id: i64) -> BridgedUser {
    BridgedUser::Telegram(TelegramUser {
        id,
        username: None,
        display_name: random_string(),
        photo_id: None,
    })
}

// So that tests sharing a pooled env don't find each other's links
fn random_telegram_id() -> i64 {
    random_from_u32::<u32>() as i64 + 1
}

// Relays a message from the account into the chat, returning its id and event index
fn relay(env: &mut PocketIc, bridged: &BridgedChat, from: &BridgedUser) -> (MessageId, EventIndex) {
    match send(
        env,
        bridged.bot_principal,
        bridged.local_user_index,
        bridged.chat,
        from.clone(),
    ) {
        SendResponse::Success(result) => (result.message_id, result.event_index),
        response => panic!("{response:?}"),
    }
}

// Asserts the message has just the one tip
fn assert_tipped(
    env: &PocketIc,
    reader: &User,
    chat: Chat,
    event_index: EventIndex,
    tipper: UserId,
    ledger: CanisterId,
    amount: u128,
) {
    let events = match chat {
        Chat::Channel(community_id, channel_id) => {
            client::community::happy_path::events_by_index(env, reader, community_id, channel_id, vec![event_index])
        }
        Chat::Group(group_id) => client::group::happy_path::events_by_index(env, reader, group_id, vec![event_index]),
        Chat::Direct(_) => unreachable!(),
    };
    let message = events
        .events
        .into_iter()
        .next()
        .map(|e| if let ChatEvent::Message(m) = e.event { *m } else { panic!() })
        .unwrap();
    assert_eq!(message.tips.len(), 1);
    assert_eq!(*message.tips.first().unwrap(), (ledger, vec![(tipper, amount)]));
}

// The tips the bridge bot has been told of, with the messages tipped, from the LocalUserIndex's
// notification `from_index` on
fn tips_notified(
    env: &PocketIc,
    controller: Principal,
    bridged: &BridgedChat,
    from_index: u64,
) -> Vec<(MessageId, BotMessageTip)> {
    client::local_user_index::happy_path::notifications(env, controller, bridged.local_user_index, from_index)
        .notifications
        .into_iter()
        .filter_map(|n| {
            let NotificationEnvelope::Bot(n) = n.value else {
                return None;
            };
            let encoding = *n.recipients.get(&bridged.bot_id)?;
            let payload = &n.event_map.get(&encoding)?.data;
            let wrapper: BotEventWrapper = match encoding {
                BotDataEncoding::Candid => candid::decode_one(payload).unwrap(),
                _ => msgpack::deserialize_then_unwrap(payload),
            };
            let BotEvent::Chat(BotChatEvent {
                event: ChatEvent::Message(message),
                tip: Some(tip),
                ..
            }) = wrapper.event
            else {
                return None;
            };
            Some((message.message_id, *tip))
        })
        .collect()
}

fn next_notification_index(env: &PocketIc, controller: Principal, bridged: &BridgedChat) -> u64 {
    client::local_user_index::happy_path::latest_notification_index(env, controller, bridged.local_user_index) + 1
}

// Waits for the bridge bot to be told of a tip on the message, then returns it
fn wait_for_tip_notified(
    env: &mut PocketIc,
    controller: Principal,
    bridged: &BridgedChat,
    from_index: u64,
    message_id: MessageId,
) -> BotMessageTip {
    let find = |env: &PocketIc| {
        tips_notified(env, controller, bridged, from_index)
            .into_iter()
            .find(|(m, _)| *m == message_id)
            .map(|(_, tip)| tip)
    };
    wait_until(env, "the bridge bot to be told of the tip", |env| find(env).is_some());
    find(env).unwrap()
}

// The texts of the messages the OpenChat bot has sent the user
fn openchat_bot_texts(env: &PocketIc, user: &User) -> Vec<String> {
    let response = client::user::events(
        env,
        user.principal,
        user.canister(),
        &multi_user_canister::events::Args {
            user_id: user.user_id,
            them: OPENCHAT_BOT_USER_ID,
            thread_root_message_index: None,
            start_index: EventIndex::default(),
            ascending: true,
            max_messages: 100,
            max_events: 100,
            latest_known_update: None,
        },
    );
    let multi_user_canister::events::Response::Success(result) = response else {
        return Vec::new();
    };
    result
        .events
        .into_iter()
        .filter_map(|e| match e.event {
            ChatEvent::Message(m) => match m.content {
                MessageContent::Text(t) => Some(t.text),
                _ => None,
            },
            _ => None,
        })
        .collect()
}

fn bridged_user_deposits_held(env: &PocketIc, user_index: CanisterId) -> u64 {
    try_metrics(env, user_index)
        .and_then(|metrics| metrics["bridged_user_deposits_held"].as_u64())
        .unwrap()
}

fn wait_until(env: &mut PocketIc, what: &str, condition: impl Fn(&PocketIc) -> bool) {
    for _ in 0..30 {
        if condition(env) {
            return;
        }
        env.tick();
    }
    assert!(condition(env), "timed out waiting for {what}");
}

// Reactions and replies to a relayed message are for the OpenChat user who linked the account it came
// from, as they are for a message's sender, and only if they're in the chat
#[test_case(true; "in a channel")]
#[test_case(false; "in a group")]
fn reactions_and_replies_on_relayed_messages_go_to_whoever_linked_the_account(in_community: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let member = client::register_user(env, canister_ids);
    let outsider = client::register_user(env, canister_ids);
    let (chat, location, chat_canister): (Chat, BotInstallationLocation, CanisterId) = if in_community {
        let community_id =
            client::user::happy_path::create_community(env, &owner, &random_string(), true, vec!["General".to_string()]);
        let channel_id =
            client::community::happy_path::create_channel(env, owner.principal, community_id, true, random_string());
        client::community::happy_path::join_channel(env, member.principal, community_id, channel_id);
        // In the community but not the channel, so only the channel's membership keeps activity
        // from them, as their MultiUser canister takes it from any community they're in. Joining
        // the community joins its public channels, so they leave this one.
        client::community::happy_path::join_community(env, outsider.principal, community_id);
        client::community::happy_path::leave_channel(env, outsider.principal, community_id, channel_id);
        (
            Chat::Channel(community_id, channel_id),
            BotInstallationLocation::Community(community_id),
            community_id.into(),
        )
    } else {
        let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
        client::group::happy_path::join_group(env, member.principal, group_id);
        (
            Chat::Group(group_id),
            BotInstallationLocation::Group(group_id),
            group_id.into(),
        )
    };
    let local_user_index = canister_ids.local_user_index(env, chat_canister);
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
    let owners_account = telegram_account(445566778);
    let outsiders_account = telegram_account(556677889);
    // No one links this one
    let strangers_account = telegram_account(667788990);
    let relay = |env: &mut PocketIc, from: &BridgedUser, replies_to: Option<EventIndex>| {
        let response = send_reply_in_thread(env, bot_principal, local_user_index, chat, None, replies_to, from.clone());
        match response {
            SendResponse::Success(result) => (result.message_id, result.event_index),
            response => panic!("{response:?}"),
        }
    };
    let react = |env: &mut PocketIc, user: &User, message_id: MessageId| match chat {
        Chat::Channel(community_id, channel_id) => {
            client::community::happy_path::add_reaction(env, user, community_id, channel_id, "👍", message_id)
        }
        Chat::Group(group_id) => client::group::happy_path::add_reaction(env, user, group_id, "👍", message_id),
        Chat::Direct(_) => unreachable!(),
    };
    // Sends a text message, replying to the message at `replies_to` if given
    let send_text = |env: &mut PocketIc, user: &User, replies_to: Option<EventIndex>| {
        let message_id: MessageId = random_from_u128();
        let content = MessageContentInitial::Text(TextContent { text: random_string() });
        let replies_to = replies_to.map(|event_index| GroupReplyContext { event_index });
        let event_index = match chat {
            Chat::Channel(community_id, channel_id) => {
                client::community::happy_path::send_message(
                    env,
                    user,
                    community_id,
                    channel_id,
                    None,
                    content,
                    replies_to,
                    Some(message_id),
                )
                .event_index
            }
            Chat::Group(group_id) => {
                client::group::happy_path::send_message(env, user, group_id, None, content, replies_to, Some(message_id))
                    .event_index
            }
            Chat::Direct(_) => unreachable!(),
        };
        (message_id, event_index)
    };
    let has_activity = |env: &PocketIc, user: &User, activity: MessageActivity, message_id: MessageId, by: UserId| {
        client::user::happy_path::message_activity_feed(env, user, 0)
            .events
            .iter()
            .any(|e| e.activity == activity && e.message_id == message_id && e.user_id == Some(by))
    };
    let wait_for_activity = |env: &mut PocketIc, user: &User, activity: MessageActivity, message_id: MessageId, by: UserId| {
        for _ in 0..20 {
            if has_activity(env, user, activity, message_id, by) {
                return;
            }
            env.tick();
        }
        panic!(
            "{activity:?} activity on {message_id:?} by {by} never reached {}",
            user.user_id
        );
    };

    // No one has linked the account, so there's no one to tell of a reaction
    let (unlinked_message_id, _) = relay(env, &owners_account, None);
    react(env, &member, unlinked_message_id);

    let links_before = bridged_user_links(env, canister_ids);
    let code = start_link(env, owner.principal, user_index, BridgePlatform::Telegram);
    let response = link(env, bot_principal, user_index, owners_account.clone(), &code);
    assert!(matches!(response, LinkResponse::Success(_)), "{response:?}");
    wait_for_bridged_user_links(env, canister_ids, &links_before, 1);

    // Once it's linked, whoever linked it is told of reactions to its messages
    let (message_id, event_index) = relay(env, &owners_account, None);
    react(env, &member, message_id);
    wait_for_activity(env, &owner, MessageActivity::Reaction, message_id, member.user_id);

    // And of replies to them, in which they're mentioned
    let (reply_id, _) = send_text(env, &member, Some(event_index));
    wait_for_activity(env, &owner, MessageActivity::QuoteReply, reply_id, member.user_id);
    let mentions = match chat {
        Chat::Channel(community_id, channel_id) => {
            client::community::happy_path::channel_summary(env, &owner, community_id, channel_id)
                .membership
                .unwrap()
                .mentions
        }
        Chat::Group(group_id) => {
            client::group::happy_path::summary(env, owner.principal, group_id)
                .membership
                .unwrap()
                .mentions
        }
        Chat::Direct(_) => unreachable!(),
    };
    assert!(mentions.iter().any(|m| m.message_id == reply_id), "{mentions:?}");

    // Including replies relayed from the other platform, which before reached no one, even when they
    // replied to an OpenChat user's message
    let (relayed_reply_id, _) = relay(env, &strangers_account, Some(event_index));
    wait_for_activity(env, &owner, MessageActivity::QuoteReply, relayed_reply_id, bot_id);
    let (_, members_event_index) = send_text(env, &member, None);
    let (relayed_reply_to_member_id, _) = relay(env, &strangers_account, Some(members_event_index));
    wait_for_activity(env, &member, MessageActivity::QuoteReply, relayed_reply_to_member_id, bot_id);

    // Whoever linked an account isn't told of activity on its messages if they aren't in the chat
    let code = start_link(env, outsider.principal, user_index, BridgePlatform::Telegram);
    let response = link(env, bot_principal, user_index, outsiders_account.clone(), &code);
    assert!(matches!(response, LinkResponse::Success(_)), "{response:?}");
    wait_for_bridged_user_links(env, canister_ids, &links_before, 2);
    let (outsiders_message_id, _) = relay(env, &outsiders_account, None);
    react(env, &member, outsiders_message_id);

    // Nor of their own reactions or replies, nor of replies relayed from the same account
    react(env, &owner, message_id);
    let (own_reply_id, _) = send_text(env, &owner, Some(event_index));
    let (own_relayed_reply_id, _) = relay(env, &owners_account, Some(event_index));

    // Activity for the owner is sent in order, so once this arrives, none of the above is still to come
    let (last_message_id, _) = relay(env, &owners_account, None);
    react(env, &member, last_message_id);
    wait_for_activity(env, &owner, MessageActivity::Reaction, last_message_id, member.user_id);
    tick_many(env, 5);

    assert!(!has_activity(
        env,
        &owner,
        MessageActivity::Reaction,
        unlinked_message_id,
        member.user_id
    ));
    assert!(!has_activity(
        env,
        &owner,
        MessageActivity::Reaction,
        message_id,
        owner.user_id
    ));
    assert!(!has_activity(
        env,
        &owner,
        MessageActivity::QuoteReply,
        own_reply_id,
        owner.user_id
    ));
    assert!(!has_activity(
        env,
        &owner,
        MessageActivity::QuoteReply,
        own_relayed_reply_id,
        bot_id
    ));
    assert!(
        client::user::happy_path::message_activity_feed(env, &outsider, 0)
            .events
            .iter()
            .all(|e| e.message_id != outsiders_message_id)
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
    tip_to(
        env,
        tipper,
        chat,
        message_id,
        icrc1::Account::legacy_for_user(recipient),
        ledger,
        amount,
    )
}

// Tips a group or channel message, addressing the transfer to the account `to`
fn tip_to(
    env: &mut PocketIc,
    tipper: &User,
    chat: Chat,
    message_id: MessageId,
    to: icrc1::Account,
    ledger: CanisterId,
    amount: u128,
) -> UnitResult {
    let transfer = PendingCryptoTransaction::ICRC2(icrc2::PendingCryptoTransaction {
        ledger,
        token_symbol: ICP_SYMBOL.to_string(),
        amount,
        from: tipper.principal.into(),
        to,
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

#[test]
fn twitch_bridge_bot_relays_messages_and_links_accounts() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    env.advance_time(Duration::from_millis(1));
    let owner = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &owner, &random_string(), true, true);
    let group = Chat::Group(group_id);
    let local_user_index = canister_ids.local_user_index(env, group_id);

    let (bot_id, bot_principal) = register_bot(env, &owner, canister_ids.user_index, random_string(), random_string());
    let permissions = BotPermissions::default().with_message(&HashSet::from_iter([MessagePermission::Text]));
    client::local_user_index::happy_path::install_bot(
        env,
        owner.principal,
        local_user_index,
        BotInstallationLocation::Group(group_id),
        bot_id,
        permissions.clone(),
        Some(permissions),
    );

    let operator = client::register_user(env, canister_ids);
    client::user_index::happy_path::add_platform_operator(env, *controller, canister_ids.user_index, operator.user_id);
    tick_many(env, 3);
    let response = set_bridge_bot(
        env,
        operator.principal,
        canister_ids.user_index,
        BridgePlatform::Twitch,
        Some(bot_id),
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    wait_for_bridge_bot_everywhere(env, canister_ids, BridgePlatform::Twitch, Some(bot_id));

    let twitch_author = TwitchUser {
        id: 141981764,
        login: "nelly".to_string(),
        display_name: "Nelly".to_string(),
        profile_image: Some("jtv_user_pictures/8a6381c7-d0c0-4576-b179-38bd5ce1d6af-profile_image-300x300.png".to_string()),
    };
    let from_twitch = BridgedUser::Twitch(twitch_author.clone());

    let response = send(env, bot_principal, local_user_index, group, from_twitch.clone());
    let SendResponse::Success(message) = response else {
        panic!("'bot_send_message' error: {response:?}");
    };
    let events = client::group::happy_path::events_by_index(env, &owner, group_id, vec![message.event_index]);
    assert_relayed_from(&events, bot_id, &from_twitch);
    wait_for_bridged_user(env, canister_ids.user_index, &from_twitch);

    // A profile image anywhere but Twitch's CDN is rejected
    let response = send(
        env,
        bot_principal,
        local_user_index,
        group,
        BridgedUser::Twitch(TwitchUser {
            profile_image: Some("https://example.com/avatar.png".to_string()),
            ..twitch_author
        }),
    );
    assert!(
        matches!(&response, SendResponse::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "{response:?}"
    );

    // A user links their Twitch account through the bridge bot
    let user_index = canister_ids.user_index;
    let code = start_link(env, owner.principal, user_index, BridgePlatform::Twitch);
    let response = link(env, bot_principal, user_index, from_twitch.clone(), &code);
    assert!(matches!(response, LinkResponse::Success(_)), "{response:?}");
    assert_eq!(linked_user_id(env, user_index, &from_twitch), Some(owner.user_id));

    // Unlinked and unset, which leaves the pooled env as it was
    let response = unlink(env, bot_principal, user_index, &from_twitch);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    let response = set_bridge_bot(env, operator.principal, user_index, BridgePlatform::Twitch, None);
    assert!(matches!(response, UnitResult::Success), "{response:?}");
    wait_for_bridge_bot_everywhere(env, canister_ids, BridgePlatform::Twitch, None);
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
    send_reply_in_thread(env, bot_principal, local_user_index, chat, thread, None, bridged_from)
}

fn send_reply_in_thread(
    env: &mut PocketIc,
    bot_principal: Principal,
    local_user_index: CanisterId,
    chat: Chat,
    thread: Option<MessageIndex>,
    replies_to: Option<EventIndex>,
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
            replies_to,
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
