use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::utils::{now_nanos, tick_many};
use crate::{client, TestEnv};
use constants::{ICP_LEDGER_CANISTER_ID, ICP_SYMBOL, ICP_TRANSFER_FEE};
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_from_u128, random_principal, random_string};
use types::{ChatEvent, CryptoContent, CryptoTransaction, MessageContent, MessageContentInitial, PendingCryptoTransaction};

#[test_case(false, false)]
#[test_case(true, false)]
#[test_case(false, true)]
#[test_case(true, true)]
fn send_direct_message_with_transfer_succeeds(with_c2c_error: bool, icrc2: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    if with_c2c_error {
        stop_canister(env, user2.local_user_index, user2.canister());
    }

    let ledger = ICP_LEDGER_CANISTER_ID;
    let amount = 1_000_000;
    let fee = ICP_TRANSFER_FEE;
    let now_nanos = now_nanos(env);

    let transaction = if icrc2 {
        // Approve user1's canister to transfer some ICP
        let random_principal = random_principal();
        client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, random_principal, 1_000_000_000);
        client::ledger::happy_path::approve(env, random_principal, canister_ids.icp_ledger, user1.user_id, amount + fee);

        PendingCryptoTransaction::ICRC2(types::icrc2::PendingCryptoTransaction {
            ledger,
            fee,
            token_symbol: ICP_SYMBOL.to_string(),
            amount,
            from: random_principal.into(),
            to: user2.user_id.into(),
            memo: None,
            created: now_nanos,
        })
    } else {
        // Send user1 some ICP
        client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user1.user_id, 1_000_000_000);

        PendingCryptoTransaction::ICRC1(types::icrc1::PendingCryptoTransaction {
            ledger,
            fee,
            token_symbol: ICP_SYMBOL.to_string(),
            amount,
            to: user2.user_id.into(),
            memo: None,
            created: now_nanos,
        })
    };

    let send_message_result = client::user::send_message_v2(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content: MessageContentInitial::Crypto(CryptoContent {
                recipient: user2.user_id,
                transfer: CryptoTransaction::Pending(transaction),
                caption: None,
            }),
            replies_to: None,
            forwarding: false,
            block_level_markdown: false,
            message_filter_failed: None,
            pin: None,
            correlation_id: 0,
        },
    );

    assert!(matches!(
        send_message_result,
        user_canister::send_message_v2::Response::TransferSuccessV2(_)
    ));

    tick_many(env, 3);

    let user2_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id);
    assert_eq!(user2_balance, amount);

    if with_c2c_error {
        env.advance_time(Duration::from_secs(10));
        start_canister(env, user2.local_user_index, user2.canister());
        tick_many(env, 3);
    }

    let event = client::user::happy_path::events(env, &user2, user1.user_id, 0.into(), true, 10, 10)
        .events
        .pop()
        .unwrap()
        .event;

    if let ChatEvent::Message(m) = event {
        assert!(matches!(m.content, MessageContent::Crypto(_)));
    } else {
        panic!("{event:?}");
    }
}

#[test_case(false, false)]
#[test_case(true, false)]
#[test_case(false, true)]
#[test_case(true, true)]
fn send_message_with_transfer_to_group_succeeds(with_c2c_error: bool, icrc2: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), true, true);
    client::group::happy_path::join_group(env, user2.principal, group_id);

    let ledger = ICP_LEDGER_CANISTER_ID;
    let amount = 1_000_000;
    let fee = ICP_TRANSFER_FEE;
    let now_nanos = now_nanos(env);
    let local_group_index = canister_ids.local_group_index(env, group_id);

    let transaction = if icrc2 {
        // Approve user1's canister to transfer some ICP
        let random_principal = random_principal();
        client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, random_principal, 1_000_000_000);
        client::ledger::happy_path::approve(env, random_principal, canister_ids.icp_ledger, user1.user_id, amount + fee);

        PendingCryptoTransaction::ICRC2(types::icrc2::PendingCryptoTransaction {
            ledger,
            fee,
            token_symbol: ICP_SYMBOL.to_string(),
            amount,
            from: random_principal.into(),
            to: user2.user_id.into(),
            memo: None,
            created: now_nanos,
        })
    } else {
        // Send user1 some ICP
        client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user1.user_id, 1_000_000_000);

        PendingCryptoTransaction::ICRC1(types::icrc1::PendingCryptoTransaction {
            ledger,
            fee,
            token_symbol: ICP_SYMBOL.to_string(),
            amount,
            to: user2.user_id.into(),
            memo: None,
            created: now_nanos,
        })
    };

    if with_c2c_error {
        stop_canister(env, local_group_index, group_id.into());
    }

    let send_message_result = client::user::send_message_with_transfer_to_group(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::send_message_with_transfer_to_group::Args {
            group_id,
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content: MessageContentInitial::Crypto(CryptoContent {
                recipient: user2.user_id,
                transfer: CryptoTransaction::Pending(transaction),
                caption: None,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            pin: None,
            correlation_id: 0,
        },
    );

    if with_c2c_error {
        assert!(matches!(
            send_message_result,
            user_canister::send_message_with_transfer_to_group::Response::Retrying(..)
        ));
    } else {
        assert!(matches!(
            send_message_result,
            user_canister::send_message_with_transfer_to_group::Response::Success(_)
        ));
    }

    let user2_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id);
    assert_eq!(user2_balance, amount);

    if with_c2c_error {
        env.advance_time(Duration::from_secs(10));
        start_canister(env, local_group_index, group_id.into());
    }

    let event = client::group::happy_path::events(env, &user2, group_id, 0.into(), true, 10, 10)
        .events
        .pop()
        .unwrap()
        .event;

    if let ChatEvent::Message(m) = event {
        assert!(matches!(m.content, MessageContent::Crypto(_)));
    } else {
        panic!("{event:?}");
    }
}
