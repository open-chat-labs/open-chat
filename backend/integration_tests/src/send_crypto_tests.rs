use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::utils::{now_nanos, tick_many, wait_for_direct_chat};
use crate::{TestEnv, client};
use constants::{ICP_LEDGER_CANISTER_ID, ICP_SYMBOL, ICP_TRANSFER_FEE};
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_from_u128, random_principal, random_string};
use types::{ChatEvent, CryptoContent, CryptoTransaction, MessageContent, MessageContentInitial, PendingCryptoTransaction};

// The transfer is pulled via ICRC2 from the sender's wallet, or from another account which approved
// their canister, under their spender subaccount
#[test_case(false, false)]
#[test_case(true, false)]
#[test_case(false, true)]
#[test_case(true, true)]
fn send_direct_message_with_transfer_succeeds(with_c2c_error: bool, from_approved_account: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        platform_operator,
        ..
    } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    // In a canister of their own, which can be stopped without stopping user1's
    let user2 = client::register_user_in_new_multi_user_canister(env, canister_ids, *platform_operator);

    if with_c2c_error {
        stop_canister(env, user2.local_user_index, user2.canister());
    }

    let ledger = ICP_LEDGER_CANISTER_ID;
    let amount = 1_000_000;
    let fee = ICP_TRANSFER_FEE;

    let from = if from_approved_account { random_principal() } else { user1.principal };
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, from, 1_000_000_000);
    client::ledger::happy_path::approve(
        env,
        from,
        canister_ids.icp_ledger,
        spender(&user1, user1.canister()),
        amount + fee,
    );

    let send_message_result = client::user::send_message_v2(
        env,
        user1.principal,
        user1.canister(),
        &multi_user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content: MessageContentInitial::Crypto(CryptoContent {
                recipient: user2.user_id,
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC2(types::icrc2::PendingCryptoTransaction {
                    ledger,
                    fee,
                    token_symbol: ICP_SYMBOL.to_string(),
                    amount,
                    from: from.into(),
                    to: types::icrc1::Account::legacy_for_user(user2.user_id),
                    memo: None,
                    created: now_nanos(env),
                })),
                caption: None,
            }),
            replies_to: None,
            forwarding: false,
            block_level_markdown: false,
            message_filter_failed: None,
            pin: None,
            og_previews: Vec::new(),
        },
    );

    assert!(
        matches!(
            send_message_result,
            multi_user_canister::send_message_v2::Response::TransferSuccessV2(_)
        ),
        "{send_message_result:?}"
    );

    let user2_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user2);
    assert_eq!(user2_balance, amount);

    if with_c2c_error {
        // Long enough for the message to reach the stopped canister and the failure to come back, even
        // if the canisters are on different subnets
        tick_many(env, 25);

        // Start the canister before advancing the time, else the retry falls due while it is still
        // stopped and is spent on another failure
        start_canister(env, user2.local_user_index, user2.canister());
        env.advance_time(Duration::from_secs(10));
    }

    wait_for_direct_chat(env, &user2, user1.user_id);

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

// The group pulls the transfer via ICRC2 from the sender's wallet, or from another account which
// approved it, under the sender's spender subaccount
#[test_case(false)]
#[test_case(true)]
fn send_message_with_transfer_to_group_succeeds(from_approved_account: bool) {
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

    let from = if from_approved_account { random_principal() } else { user1.principal };
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, from, 1_000_000_000);
    client::ledger::happy_path::approve(
        env,
        from,
        canister_ids.icp_ledger,
        spender(&user1, group_id.into()),
        amount + fee,
    );

    let send_message_result = client::group::send_message_v2(
        env,
        user1.principal,
        group_id.into(),
        &group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content: MessageContentInitial::Crypto(CryptoContent {
                recipient: user2.user_id,
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC2(types::icrc2::PendingCryptoTransaction {
                    ledger,
                    fee,
                    token_symbol: ICP_SYMBOL.to_string(),
                    amount,
                    from: from.into(),
                    to: types::icrc1::Account::legacy_for_user(user2.user_id),
                    memo: None,
                    created: now_nanos(env),
                })),
                caption: None,
            }),
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
    );

    assert!(
        matches!(send_message_result, group_canister::send_message_v2::Response::Success(_)),
        "{send_message_result:?}"
    );

    let user2_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user2);
    assert_eq!(user2_balance, amount);

    tick_many(env, 3);

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

#[test]
fn send_crypto_to_a_bot_is_refused() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, &user, 1_000_000_000);
    let bot: types::UserId = canister_ids.proposals_bot.into();

    let response = client::user::send_message_v2(
        env,
        user.principal,
        user.user_id.canister_id(),
        &multi_user_canister::send_message_v2::Args {
            recipient: bot,
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content: MessageContentInitial::Crypto(CryptoContent {
                recipient: bot,
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(types::icrc1::PendingCryptoTransaction {
                    ledger: ICP_LEDGER_CANISTER_ID,
                    fee: ICP_TRANSFER_FEE,
                    token_symbol: ICP_SYMBOL.to_string(),
                    amount: 1_000_000,
                    to: bot.as_principal().into(),
                    memo: None,
                    created: now_nanos(env),
                })),
                caption: None,
            }),
            replies_to: None,
            forwarding: false,
            block_level_markdown: false,
            message_filter_failed: None,
            pin: None,
            og_previews: Vec::new(),
        },
    );

    assert!(
        matches!(&response, multi_user_canister::send_message_v2::Response::Error(e) if e.matches_code(oc_error_codes::OCErrorCode::InvalidRequest)),
        "{response:?}"
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user),
        1_000_000_000
    );
}

// The account `canister_id` pulls from under the user's spender subaccount
fn spender(user: &crate::User, canister_id: types::CanisterId) -> icrc_ledger_types::icrc1::account::Account {
    icrc_ledger_types::icrc1::account::Account {
        owner: canister_id,
        subaccount: Some(ledger_utils::spender_subaccount(user.principal)),
    }
}
