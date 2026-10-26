use crate::bot_tests::register_bot;
use crate::env::ENV;
use crate::utils::{now_nanos, tick_many};
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use constants::{ICP_SYMBOL, ICP_TRANSFER_FEE};
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::collections::HashSet;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_from_u128, random_principal, random_string};
use types::{
    BotChatContext, BotInstallationLocation, BotMessageContent, BotPermissions, CanisterId, Chat, ChatEvent, ChatType,
    CryptoContent, CryptoTransaction, MessageContentInitial, MessagePermission, PendingCryptoTransaction, TextContent,
};

#[test]
fn tip_direct_message_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids, *controller);

    let message_id = random_from_u128();
    let tip_amount = 1_0000_0000;

    let event_index =
        client::user::happy_path::send_text_message(env, &user2, user1.user_id, "TEXT", Some(message_id)).event_index;

    tick_many(env, 3);

    client::user::happy_path::tip_message(
        env,
        &user1,
        user2.user_id,
        Chat::Direct(user2.user_id.into()),
        message_id,
        canister_ids.icp_ledger,
        ICP_SYMBOL.to_string(),
        tip_amount,
        ICP_TRANSFER_FEE,
    );

    tick_many(env, 3);

    let user1_message = client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![event_index])
        .events
        .pop()
        .map(|e| if let ChatEvent::Message(m) = e.event { *m } else { panic!() })
        .unwrap();

    assert_eq!(user1_message.tips.len(), 1);
    assert_eq!(
        *user1_message.tips.first().unwrap(),
        (canister_ids.icp_ledger, vec![(user1.user_id, tip_amount)])
    );

    let user2_message = client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![event_index])
        .events
        .pop()
        .map(|e| if let ChatEvent::Message(m) = e.event { *m } else { panic!() })
        .unwrap();

    assert_eq!(user2_message.tips.len(), 1);
    assert_eq!(
        *user2_message.tips.first().unwrap(),
        (canister_ids.icp_ledger, vec![(user1.user_id, tip_amount)])
    );

    let user2_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user2);
    assert_eq!(user2_balance, tip_amount);
}

#[test]
fn tip_group_message_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids, *controller);

    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), true, true);
    let message_id = random_from_u128();
    let tip_amount = 1_0000_0000;

    client::group::happy_path::join_group(env, user2.principal, group_id);

    let event_index =
        client::group::happy_path::send_text_message(env, &user2, group_id, None, random_string(), Some(message_id))
            .event_index;

    client::user::happy_path::tip_message(
        env,
        &user1,
        user2.user_id,
        Chat::Group(group_id),
        message_id,
        canister_ids.icp_ledger,
        ICP_SYMBOL.to_string(),
        tip_amount,
        ICP_TRANSFER_FEE,
    );

    let message = client::group::happy_path::events_by_index(env, &user2, group_id, vec![event_index])
        .events
        .pop()
        .map(|e| if let ChatEvent::Message(m) = e.event { *m } else { panic!() })
        .unwrap();

    assert_eq!(message.tips.len(), 1);
    assert_eq!(
        *message.tips.first().unwrap(),
        (canister_ids.icp_ledger, vec![(user1.user_id, tip_amount)])
    );

    let user2_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user2);
    assert_eq!(user2_balance, tip_amount);
}

#[test]
fn tip_channel_message_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids, *controller);

    let community_id = client::user::happy_path::create_community(env, &user1, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string());
    let message_id = random_from_u128();
    let tip_amount = 1_0000_0000;

    client::community::happy_path::join_channel(env, user2.principal, community_id, channel_id);

    let event_index = client::community::happy_path::send_text_message(
        env,
        &user2,
        community_id,
        channel_id,
        None,
        random_string(),
        Some(message_id),
    )
    .event_index;

    client::user::happy_path::tip_message(
        env,
        &user1,
        user2.user_id,
        Chat::Channel(community_id, channel_id),
        message_id,
        canister_ids.icp_ledger,
        ICP_SYMBOL.to_string(),
        tip_amount,
        ICP_TRANSFER_FEE,
    );

    let message = client::community::happy_path::events_by_index(env, &user2, community_id, channel_id, vec![event_index])
        .events
        .pop()
        .map(|e| if let ChatEvent::Message(m) = e.event { *m } else { panic!() })
        .unwrap();

    assert_eq!(message.tips.len(), 1);
    assert_eq!(
        *message.tips.first().unwrap(),
        (canister_ids.icp_ledger, vec![(user1.user_id, tip_amount)])
    );

    let user2_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user2);
    assert_eq!(user2_balance, tip_amount);
}

// A tip given from an account OpenChat does not control, pulled via ICRC-2 against an allowance
// that account granted to the tipper's canister, under the tipper's spender subaccount. This is how
// tipping from an external wallet works.
#[test]
fn tip_direct_message_from_approved_account_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids, *controller);

    let tip_amount = 1_0000_0000;
    let external_wallet = random_principal();
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, external_wallet, 10_000_000_000);
    // The allowance has to cover the transfer fee too, since that is charged to the `from` account.
    client::ledger::happy_path::approve(
        env,
        external_wallet,
        canister_ids.icp_ledger,
        icrc_ledger_types::icrc1::account::Account {
            owner: user1.canister(),
            subaccount: Some(ledger_utils::spender_subaccount(user1.principal)),
        },
        tip_amount + ICP_TRANSFER_FEE,
    );

    let user1_balance_before = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user1);

    let message_id = random_from_u128();
    let event_index =
        client::user::happy_path::send_text_message(env, &user2, user1.user_id, "TEXT", Some(message_id)).event_index;

    tick_many(env, 3);

    let response = client::user::tip_message(
        env,
        user1.principal,
        user1.canister(),
        &multi_user_canister::tip_message::Args {
            chat: Chat::Direct(user2.user_id.into()),
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id,
            ledger: canister_ids.icp_ledger,
            token_symbol: ICP_SYMBOL.to_string(),
            amount: tip_amount,
            fee: ICP_TRANSFER_FEE,
            decimals: 8,
            from_account: Some(external_wallet.into()),
            pin: None,
        },
    );
    assert!(
        matches!(response, multi_user_canister::tip_message::Response::Success),
        "{response:?}"
    );

    tick_many(env, 3);

    // The tip is attributed to the OpenChat user, not to the account which funded it.
    let message = client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![event_index])
        .events
        .pop()
        .map(|e| if let ChatEvent::Message(m) = e.event { *m } else { panic!() })
        .unwrap();

    assert_eq!(message.tips.len(), 1);
    assert_eq!(
        *message.tips.first().unwrap(),
        (canister_ids.icp_ledger, vec![(user1.user_id, tip_amount)])
    );

    // The funds came out of the approved account, so the tipper's own balance is untouched.
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user1),
        user1_balance_before
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user2),
        tip_amount
    );
}

// Spending from an account of the tipper's canister would need an approval it had granted itself, so
// it is rejected up front rather than left to fail at the ledger.
#[test]
fn tip_from_own_account_is_rejected() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2 } = init_test_data(env, canister_ids, *controller);

    let message_id = random_from_u128();
    client::user::happy_path::send_text_message(env, &user2, user1.user_id, "TEXT", Some(message_id));

    tick_many(env, 3);

    let response = client::user::tip_message(
        env,
        user1.principal,
        user1.canister(),
        &multi_user_canister::tip_message::Args {
            chat: Chat::Direct(user2.user_id.into()),
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id,
            ledger: canister_ids.icp_ledger,
            token_symbol: ICP_SYMBOL.to_string(),
            amount: 1_0000_0000,
            fee: ICP_TRANSFER_FEE,
            decimals: 8,
            from_account: Some(user1.canister().into()),
            pin: None,
        },
    );

    assert!(
        matches!(response, multi_user_canister::tip_message::Response::Error(_)),
        "{response:?}"
    );
}

#[test_case(ChatType::Group)]
#[test_case(ChatType::Channel)]
fn a_bot_cant_be_tipped_or_sent_crypto(chat_type: ChatType) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, .. } = init_test_data(env, canister_ids, *controller);

    let (chat, location, canister_id): (Chat, BotInstallationLocation, CanisterId) = match chat_type {
        ChatType::Group => {
            let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), true, true);
            (
                Chat::Group(group_id),
                BotInstallationLocation::Group(group_id),
                group_id.into(),
            )
        }
        ChatType::Channel => {
            let community_id =
                client::user::happy_path::create_community(env, &user1, &random_string(), true, vec!["General".to_string()]);
            let channel_id =
                client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string());
            (
                Chat::Channel(community_id, channel_id),
                BotInstallationLocation::Community(community_id),
                community_id.into(),
            )
        }
        ChatType::Direct => unreachable!(),
    };
    let local_user_index = canister_ids.local_user_index(env, canister_id);

    let (bot_id, bot_principal) = register_bot(env, &user1, canister_ids.user_index, random_string(), random_string());
    let permissions = BotPermissions::default().with_message(&HashSet::from_iter([MessagePermission::Text]));
    client::local_user_index::happy_path::install_bot(
        env,
        user1.principal,
        local_user_index,
        location,
        bot_id,
        permissions.clone(),
        Some(permissions),
    );

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    let message_id = random_from_u128();
    let response = client::local_user_index::bot_send_message(
        env,
        bot_principal,
        local_user_index,
        &local_user_index_canister::bot_send_message::Args {
            chat_context: BotChatContext::Autonomous(chat),
            thread: None,
            message_id: Some(message_id),
            replies_to: None,
            content: BotMessageContent::Text(TextContent { text: random_string() }),
            block_level_markdown: false,
            finalised: true,
            og_previews: None,
            bridged_from: None,
        },
    );
    assert!(
        matches!(response, local_user_index_canister::bot_send_message::Response::Success(_)),
        "{response:?}"
    );

    tick_many(env, 3);

    // A bot's id isn't an account anyone controls, so a tip paid to it would be lost
    let response = client::user::tip_message_in_chat(
        env,
        &user1,
        bot_id,
        chat,
        message_id,
        canister_ids.icp_ledger,
        ICP_SYMBOL.to_string(),
        1_0000_0000,
        ICP_TRANSFER_FEE,
    );

    assert!(
        matches!(&response, multi_user_canister::tip_message::Response::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)),
        "{response:?}"
    );

    // Nor can it be sent crypto
    let content = MessageContentInitial::Crypto(CryptoContent {
        recipient: bot_id,
        transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(types::icrc1::PendingCryptoTransaction {
            ledger: canister_ids.icp_ledger,
            fee: ICP_TRANSFER_FEE,
            token_symbol: ICP_SYMBOL.to_string(),
            amount: 1_0000_0000,
            to: bot_id.as_principal().into(),
            memo: None,
            created: now_nanos(env),
        })),
        caption: None,
    });
    let error = match chat {
        Chat::Group(group_id) => match client::group::send_message_with_transfer(
            env,
            &user1,
            group_id,
            group_canister::send_message_v2::Args {
                thread_root_message_index: None,
                message_id: random_from_u128(),
                content,
                sender_name: user1.username(),
                sender_display_name: None,
                replies_to: None,
                mentioned: Vec::new(),
                forwarding: false,
                block_level_markdown: false,
                rules_accepted: None,
                message_filter_failed: None,
                new_achievement: false,
                og_previews: Vec::new(),
            },
        ) {
            group_canister::send_message_v2::Response::Error(error) => error,
            response => panic!("{response:?}"),
        },
        Chat::Channel(community_id, channel_id) => match client::community::send_message_with_transfer(
            env,
            &user1,
            community_id,
            community_canister::send_message::Args {
                channel_id,
                thread_root_message_index: None,
                message_id: random_from_u128(),
                content,
                sender_name: user1.username(),
                sender_display_name: None,
                replies_to: None,
                mentioned: Vec::new(),
                forwarding: false,
                block_level_markdown: false,
                community_rules_accepted: None,
                channel_rules_accepted: None,
                message_filter_failed: None,
                new_achievement: false,
                og_previews: Vec::new(),
            },
        ) {
            community_canister::send_message::Response::Error(error) => error,
            response => panic!("{response:?}"),
        },
        Chat::Direct(_) => unreachable!(),
    };
    assert!(error.matches_code(OCErrorCode::InvalidRequest), "{error:?}");

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, bot_id.as_principal()),
        0
    );
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);

    client::ledger::happy_path::transfer(env, controller, canister_ids.icp_ledger, &user1, 10_000_000_000);

    tick_many(env, 3);

    TestData { user1, user2 }
}

struct TestData {
    user1: User,
    user2: User,
}
