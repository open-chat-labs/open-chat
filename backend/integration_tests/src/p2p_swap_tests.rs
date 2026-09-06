use crate::env::ENV;
use crate::utils::{chat_token_info, icp_token_info, tick_many};
use crate::{TestEnv, client};
use constants::{CHAT_TRANSFER_FEE, DAY_IN_MS, MINUTE_IN_MS};
use oc_error_codes::OCErrorCode;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_from_u128, random_principal, random_string};
use types::{ChatEvent, MessageContent, MessageContentInitial, P2PSwapContentInitial, P2PSwapStatus, icrc1};

#[test]
fn p2p_swap_in_direct_chat_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);

    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user1.user_id, 1_100_000_000);
    client::ledger::happy_path::transfer(env, *controller, canister_ids.chat_ledger, user2.user_id, 11_000_000_000);

    let message_id = random_from_u128();

    let send_message_response = client::user::send_message_v2(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::P2PSwap(P2PSwapContentInitial {
                token0: icp_token_info(),
                token0_amount: 1_000_000_000,
                token1: chat_token_info(),
                token1_amount: 10_000_000_000,
                expires_in: DAY_IN_MS,
                caption: None,
                from_account: None,
            }),
            replies_to: None,
            forwarding: false,
            block_level_markdown: false,
            message_filter_failed: None,
            pin: None,
            og_previews: Vec::new(),
        },
    );

    assert!(matches!(
        send_message_response,
        user_canister::send_message_v2::Response::TransferSuccessV2(_)
    ));

    env.tick();

    let accept_offer_response = client::user::accept_p2p_swap(
        env,
        user2.principal,
        user2.canister(),
        &user_canister::accept_p2p_swap::Args {
            user_id: user1.user_id,
            thread_root_message_index: None,
            message_id,
            pin: None,
            from_account: None,
        },
    );

    assert!(matches!(
        accept_offer_response,
        user_canister::accept_p2p_swap::Response::Success(_)
    ));

    tick_many(env, 10);

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, user1.user_id),
        10_000_000_000
    );

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id),
        1_000_000_000
    );

    let user1_event = client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![1.into()])
        .events
        .pop()
        .unwrap()
        .event;

    verify_swap_status(
        user1_event,
        |status| matches!(status, P2PSwapStatus::Completed(c) if c.accepted_by == user2.user_id),
    );

    let user2_event = client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![1.into()])
        .events
        .pop()
        .unwrap()
        .event;

    verify_swap_status(
        user2_event,
        |status| matches!(status, P2PSwapStatus::Completed(c) if c.accepted_by == user2.user_id),
    );
}

#[test]
fn p2p_swap_in_group_succeeds() {
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

    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user1.user_id, 1_100_000_000);
    client::ledger::happy_path::transfer(env, *controller, canister_ids.chat_ledger, user2.user_id, 11_000_000_000);

    let message_id = random_from_u128();

    let send_message_response = client::user::send_message_with_transfer_to_group(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_with_transfer_to_group::Args {
            group_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::P2PSwap(P2PSwapContentInitial {
                token0: icp_token_info(),
                token0_amount: 1_000_000_000,
                token1: chat_token_info(),
                token1_amount: 10_000_000_000,
                expires_in: DAY_IN_MS,
                caption: None,
                from_account: None,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            pin: None,
            og_previews: Vec::new(),
        },
    );

    assert!(matches!(
        send_message_response,
        user_canister::send_message_with_transfer_to_group::Response::Success(_)
    ));

    let accept_offer_response = client::group::accept_p2p_swap(
        env,
        user2.principal,
        group_id.into(),
        &group_canister::accept_p2p_swap::Args {
            thread_root_message_index: None,
            message_id,
            pin: None,
            new_achievement: false,
            from_account: None,
        },
    );

    assert!(matches!(
        accept_offer_response,
        group_canister::accept_p2p_swap::Response::Success(_)
    ));

    tick_many(env, 10);

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, user1.user_id),
        10_000_000_000
    );

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id),
        1_000_000_000
    );

    let event = client::group::happy_path::events_by_index(env, &user1, group_id, vec![2.into()])
        .events
        .pop()
        .unwrap()
        .event;

    verify_swap_status(
        event,
        |status| matches!(status, P2PSwapStatus::Completed(c) if c.accepted_by == user2.user_id),
    );
}

// A swap where neither side spends from their OpenChat canister - both deposits are pulled via
// ICRC-2 against allowances the external wallets granted. This is how swapping from an external
// wallet works. The proceeds still land in each user's OpenChat account, not back in their wallet.
#[test]
fn p2p_swap_in_direct_chat_from_approved_accounts_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);

    let user1_wallet = random_principal();
    let user2_wallet = random_principal();

    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user1_wallet, 1_100_000_000);
    client::ledger::happy_path::transfer(env, *controller, canister_ids.chat_ledger, user2_wallet, 11_000_000_000);

    client::ledger::happy_path::approve(env, user1_wallet, canister_ids.icp_ledger, user1.user_id, 1_050_000_000);
    client::ledger::happy_path::approve(env, user2_wallet, canister_ids.chat_ledger, user2.user_id, 10_500_000_000);

    // A diamond user is funded with ICP to pay for their membership, so what we check afterwards is
    // that these balances are untouched, not that they are empty.
    let user1_icp_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user1.user_id);
    let user2_chat_balance = client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, user2.user_id);

    let message_id = random_from_u128();

    let send_message_response = client::user::send_message_v2(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::P2PSwap(P2PSwapContentInitial {
                token0: icp_token_info(),
                token0_amount: 1_000_000_000,
                token1: chat_token_info(),
                token1_amount: 10_000_000_000,
                expires_in: DAY_IN_MS,
                caption: None,
                from_account: Some(user1_wallet.into()),
            }),
            replies_to: None,
            forwarding: false,
            block_level_markdown: false,
            message_filter_failed: None,
            pin: None,
            og_previews: Vec::new(),
        },
    );

    assert!(matches!(
        send_message_response,
        user_canister::send_message_v2::Response::TransferSuccessV2(_)
    ));

    env.tick();

    let accept_offer_response = client::user::accept_p2p_swap(
        env,
        user2.principal,
        user2.canister(),
        &user_canister::accept_p2p_swap::Args {
            user_id: user1.user_id,
            thread_root_message_index: None,
            message_id,
            pin: None,
            from_account: Some(user2_wallet.into()),
        },
    );

    assert!(matches!(
        accept_offer_response,
        user_canister::accept_p2p_swap::Response::Success(_)
    ));

    tick_many(env, 10);

    // Each side is paid into their OpenChat account, having funded the swap from their wallet.
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, user1.user_id),
        10_000_000_000
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id),
        1_000_000_000
    );

    // Neither user's own account was ever debited.
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user1.user_id),
        user1_icp_balance
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, user2.user_id),
        user2_chat_balance
    );

    let user1_event = client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![1.into()])
        .events
        .pop()
        .unwrap()
        .event;

    verify_swap_status(
        user1_event,
        |status| matches!(status, P2PSwapStatus::Completed(c) if c.accepted_by == user2.user_id),
    );
}

// The group path takes the deposit via `c2c_accept_p2p_swap` rather than `accept_p2p_swap`, so it
// needs covering separately.
#[test]
fn p2p_swap_in_group_from_approved_accounts_succeeds() {
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

    let user1_wallet = random_principal();
    let user2_wallet = random_principal();

    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user1_wallet, 1_100_000_000);
    client::ledger::happy_path::transfer(env, *controller, canister_ids.chat_ledger, user2_wallet, 11_000_000_000);

    client::ledger::happy_path::approve(env, user1_wallet, canister_ids.icp_ledger, user1.user_id, 1_050_000_000);
    client::ledger::happy_path::approve(env, user2_wallet, canister_ids.chat_ledger, user2.user_id, 10_500_000_000);

    // A diamond user is funded with ICP to pay for their membership, so what we check afterwards is
    // that these balances are untouched, not that they are empty.
    let user1_icp_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user1.user_id);
    let user2_chat_balance = client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, user2.user_id);

    let message_id = random_from_u128();

    let send_message_response = client::user::send_message_with_transfer_to_group(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_with_transfer_to_group::Args {
            group_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::P2PSwap(P2PSwapContentInitial {
                token0: icp_token_info(),
                token0_amount: 1_000_000_000,
                token1: chat_token_info(),
                token1_amount: 10_000_000_000,
                expires_in: DAY_IN_MS,
                caption: None,
                from_account: Some(user1_wallet.into()),
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            pin: None,
            og_previews: Vec::new(),
        },
    );

    assert!(matches!(
        send_message_response,
        user_canister::send_message_with_transfer_to_group::Response::Success(_)
    ));

    let accept_offer_response = client::group::accept_p2p_swap(
        env,
        user2.principal,
        group_id.into(),
        &group_canister::accept_p2p_swap::Args {
            thread_root_message_index: None,
            message_id,
            pin: None,
            new_achievement: false,
            from_account: Some(user2_wallet.into()),
        },
    );

    assert!(matches!(
        accept_offer_response,
        group_canister::accept_p2p_swap::Response::Success(_)
    ));

    tick_many(env, 10);

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, user1.user_id),
        10_000_000_000
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id),
        1_000_000_000
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user1.user_id),
        user1_icp_balance
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, user2.user_id),
        user2_chat_balance
    );
}

// Spending from our own account would need an approval we had granted ourselves, so it is rejected
// up front rather than left to fail at the ledger.
#[test]
fn p2p_swap_from_own_account_is_rejected() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);

    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user1.user_id, 1_100_000_000);

    let send_message_response = client::user::send_message_v2(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content: MessageContentInitial::P2PSwap(P2PSwapContentInitial {
                token0: icp_token_info(),
                token0_amount: 1_000_000_000,
                token1: chat_token_info(),
                token1_amount: 10_000_000_000,
                expires_in: DAY_IN_MS,
                caption: None,
                from_account: Some(icrc1::Account::for_user(user1.user_id)),
            }),
            replies_to: None,
            forwarding: false,
            block_level_markdown: false,
            message_filter_failed: None,
            pin: None,
            og_previews: Vec::new(),
        },
    );

    assert!(matches!(
        send_message_response,
        user_canister::send_message_v2::Response::Error(_)
    ));
}

#[test]
fn accept_p2p_swap_from_own_account_is_rejected() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);

    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user1.user_id, 1_100_000_000);
    client::ledger::happy_path::transfer(env, *controller, canister_ids.chat_ledger, user2.user_id, 11_000_000_000);

    let message_id = random_from_u128();

    client::user::send_message_v2(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::P2PSwap(P2PSwapContentInitial {
                token0: icp_token_info(),
                token0_amount: 1_000_000_000,
                token1: chat_token_info(),
                token1_amount: 10_000_000_000,
                expires_in: DAY_IN_MS,
                caption: None,
                from_account: None,
            }),
            replies_to: None,
            forwarding: false,
            block_level_markdown: false,
            message_filter_failed: None,
            pin: None,
            og_previews: Vec::new(),
        },
    );

    env.tick();

    let accept_offer_response = client::user::accept_p2p_swap(
        env,
        user2.principal,
        user2.canister(),
        &user_canister::accept_p2p_swap::Args {
            user_id: user1.user_id,
            thread_root_message_index: None,
            message_id,
            pin: None,
            from_account: Some(icrc1::Account::for_user(user2.user_id)),
        },
    );

    assert!(matches!(
        accept_offer_response,
        user_canister::accept_p2p_swap::Response::Error(_)
    ));
}

#[test_case(true)]
#[test_case(false)]
fn cancel_p2p_swap_in_direct_chat_succeeds(delete_message: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);

    let original_chat_balance = 11_000_000_000;

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        user1.user_id,
        original_chat_balance,
    );

    let message_id = random_from_u128();

    let send_message_response = client::user::send_message_v2(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::P2PSwap(P2PSwapContentInitial {
                token0: chat_token_info(),
                token0_amount: 10_000_000_000,
                token1: icp_token_info(),
                token1_amount: 1_000_000_000,
                expires_in: DAY_IN_MS,
                caption: None,
                from_account: None,
            }),
            replies_to: None,
            forwarding: false,
            block_level_markdown: false,
            message_filter_failed: None,
            pin: None,
            og_previews: Vec::new(),
        },
    );

    assert!(matches!(
        send_message_response,
        user_canister::send_message_v2::Response::TransferSuccessV2(_)
    ));

    tick_many(env, 3);

    if delete_message {
        let delete_message_response = client::user::delete_messages(
            env,
            user1.principal,
            user1.canister(),
            &user_canister::delete_messages::Args {
                user_id: user2.user_id,
                thread_root_message_index: None,
                message_ids: vec![message_id],
            },
        );

        assert!(matches!(
            delete_message_response,
            user_canister::delete_messages::Response::Success
        ));

        env.advance_time(Duration::from_millis(5 * MINUTE_IN_MS));
    } else {
        let cancel_swap_response = client::user::cancel_p2p_swap(
            env,
            user1.principal,
            user1.canister(),
            &user_canister::cancel_p2p_swap::Args {
                user_id: user2.user_id,
                message_id,
            },
        );

        assert!(matches!(
            cancel_swap_response,
            user_canister::cancel_p2p_swap::Response::Success
        ));
    }

    tick_many(env, 10);

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, user1.user_id),
        original_chat_balance - (2 * CHAT_TRANSFER_FEE)
    );

    if !delete_message {
        let user1_event = client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![1.into()])
            .events
            .pop()
            .unwrap()
            .event;

        verify_swap_status(
            user1_event,
            |status| matches!(status, P2PSwapStatus::Cancelled(c) if c.token0_txn_out.is_some()),
        );

        let user2_event = client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![1.into()])
            .events
            .pop()
            .unwrap()
            .event;

        verify_swap_status(
            user2_event,
            |status| matches!(status, P2PSwapStatus::Cancelled(c) if c.token0_txn_out.is_some()),
        );
    }
}

#[test_case(true)]
#[test_case(false)]
fn cancel_p2p_swap_in_group_chat_succeeds(delete_message: bool) {
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

    let original_chat_balance = 11_000_000_000;

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        user1.user_id,
        original_chat_balance,
    );

    let message_id = random_from_u128();

    let send_message_response = client::user::send_message_with_transfer_to_group(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_with_transfer_to_group::Args {
            group_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::P2PSwap(P2PSwapContentInitial {
                token0: chat_token_info(),
                token0_amount: 10_000_000_000,
                token1: icp_token_info(),
                token1_amount: 1_000_000_000,
                expires_in: DAY_IN_MS,
                caption: None,
                from_account: None,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            pin: None,
            og_previews: Vec::new(),
        },
    );

    assert!(matches!(
        send_message_response,
        user_canister::send_message_with_transfer_to_group::Response::Success(_)
    ));

    tick_many(env, 3);

    if delete_message {
        let delete_message_response = client::group::delete_messages(
            env,
            user1.principal,
            group_id.into(),
            &group_canister::delete_messages::Args {
                thread_root_message_index: None,
                message_ids: vec![message_id],
                as_platform_moderator: None,
                new_achievement: false,
            },
        );

        assert!(matches!(
            delete_message_response,
            group_canister::delete_messages::Response::Success
        ));

        env.advance_time(Duration::from_millis(5 * MINUTE_IN_MS));
    } else {
        let cancel_swap_response = client::group::cancel_p2p_swap(
            env,
            user1.principal,
            group_id.into(),
            &group_canister::cancel_p2p_swap::Args {
                thread_root_message_index: None,
                message_id,
            },
        );

        assert!(matches!(
            cancel_swap_response,
            group_canister::cancel_p2p_swap::Response::Success
        ));
    }

    tick_many(env, 10);

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, user1.user_id),
        original_chat_balance - (2 * CHAT_TRANSFER_FEE)
    );

    if !delete_message {
        let event = client::group::happy_path::events_by_index(env, &user1, group_id, vec![2.into()])
            .events
            .pop()
            .unwrap()
            .event;

        verify_swap_status(
            event,
            |status| matches!(status, P2PSwapStatus::Cancelled(c) if c.token0_txn_out.is_some()),
        );
    }
}

#[test]
fn deposit_refunded_if_swap_expires() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);

    let original_chat_balance = 11_000_000_000;

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        user1.user_id,
        original_chat_balance,
    );

    let message_id = random_from_u128();

    let send_message_response = client::user::send_message_v2(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::P2PSwap(P2PSwapContentInitial {
                token0: chat_token_info(),
                token0_amount: 10_000_000_000,
                token1: icp_token_info(),
                token1_amount: 1_000_000_000,
                expires_in: DAY_IN_MS,
                caption: None,
                from_account: None,
            }),
            replies_to: None,
            forwarding: false,
            block_level_markdown: false,
            message_filter_failed: None,
            pin: None,
            og_previews: Vec::new(),
        },
    );

    assert!(matches!(
        send_message_response,
        user_canister::send_message_v2::Response::TransferSuccessV2(_)
    ));

    env.advance_time(Duration::from_millis(DAY_IN_MS));
    tick_many(env, 10);

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, user1.user_id),
        original_chat_balance - (2 * CHAT_TRANSFER_FEE)
    );

    let user1_event = client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![1.into()])
        .events
        .pop()
        .unwrap()
        .event;

    verify_swap_status(
        user1_event,
        |status| matches!(status, P2PSwapStatus::Expired(e) if e.token0_txn_out.is_some()),
    );

    let user2_event = client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![1.into()])
        .events
        .pop()
        .unwrap()
        .event;

    verify_swap_status(
        user2_event,
        |status| matches!(status, P2PSwapStatus::Expired(e) if e.token0_txn_out.is_some()),
    );
}

#[test_case(false)]
#[test_case(true)]
fn p2p_swap_blocked_if_token_disabled(input_token: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    client::user_index::happy_path::add_platform_operator(env, *controller, canister_ids.user_index, user.user_id);

    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), true, true);

    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user.user_id, 1_100_000_000);

    let message_id = random_from_u128();

    client::registry::set_token_enabled(
        env,
        user.principal,
        canister_ids.registry,
        &registry_canister::set_token_enabled::Args {
            ledger_canister_id: if input_token { canister_ids.icp_ledger } else { canister_ids.chat_ledger },
            enabled: false,
        },
    );

    let send_message_response = client::user::send_message_with_transfer_to_group(
        env,
        user.principal,
        user.canister(),
        &user_canister::send_message_with_transfer_to_group::Args {
            group_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::P2PSwap(P2PSwapContentInitial {
                token0: icp_token_info(),
                token0_amount: 1_000_000_000,
                token1: chat_token_info(),
                token1_amount: 10_000_000_000,
                expires_in: DAY_IN_MS,
                caption: None,
                from_account: None,
            }),
            sender_name: user.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            pin: None,
            og_previews: Vec::new(),
        },
    );

    // Re-enable token so that other tests aren't affected
    client::registry::set_token_enabled(
        env,
        user.principal,
        canister_ids.registry,
        &registry_canister::set_token_enabled::Args {
            ledger_canister_id: if input_token { canister_ids.icp_ledger } else { canister_ids.chat_ledger },
            enabled: true,
        },
    );

    if let user_canister::send_message_with_transfer_to_group::Response::Error(error) = send_message_response {
        assert!(
            error
                .message()
                .is_some_and(|m| m.contains(if input_token { "Input" } else { "Output" }))
        );
    } else {
        panic!("Unexpected response: {send_message_response:?}");
    }
}

#[test]
fn p2p_swap_rejected_for_non_diamond_user() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let diamond_user = client::register_diamond_user(env, canister_ids, *controller);
    let user = client::register_user(env, canister_ids);

    // The Diamond check runs before any transfer, so the non-Diamond sender needs no funds
    let swap_content = || {
        MessageContentInitial::P2PSwap(P2PSwapContentInitial {
            token0: icp_token_info(),
            token0_amount: 1_000_000_000,
            token1: chat_token_info(),
            token1_amount: 10_000_000_000,
            expires_in: DAY_IN_MS,
            caption: None,
            from_account: None,
        })
    };

    // Direct chat
    let direct_response = client::user::send_message_v2(
        env,
        user.principal,
        user.canister(),
        &user_canister::send_message_v2::Args {
            recipient: diamond_user.user_id,
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content: swap_content(),
            replies_to: None,
            forwarding: false,
            block_level_markdown: false,
            message_filter_failed: None,
            pin: None,
            og_previews: Vec::new(),
        },
    );
    assert!(
        matches!(&direct_response, user_canister::send_message_v2::Response::Error(e) if e.matches_code(OCErrorCode::NotDiamondMember)),
        "{direct_response:?}"
    );

    // Group
    let group_id = client::user::happy_path::create_group(env, &diamond_user, &random_string(), true, true);
    client::group::happy_path::join_group(env, user.principal, group_id);
    tick_many(env, 5);

    let group_response = client::user::send_message_with_transfer_to_group(
        env,
        user.principal,
        user.canister(),
        &user_canister::send_message_with_transfer_to_group::Args {
            group_id,
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content: swap_content(),
            sender_name: user.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            pin: None,
            og_previews: Vec::new(),
        },
    );
    assert!(
        matches!(&group_response, user_canister::send_message_with_transfer_to_group::Response::Error(e) if e.matches_code(OCErrorCode::NotDiamondMember)),
        "{group_response:?}"
    );

    // Channel
    let community_id =
        client::user::happy_path::create_community(env, &diamond_user, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::summary(env, diamond_user.principal, community_id)
        .channels
        .first()
        .unwrap()
        .channel_id;
    client::community::happy_path::join_community(env, user.principal, community_id);
    tick_many(env, 5);

    let channel_response = client::user::send_message_with_transfer_to_channel(
        env,
        user.principal,
        user.canister(),
        &user_canister::send_message_with_transfer_to_channel::Args {
            community_id,
            channel_id,
            thread_root_message_index: None,
            message_id: random_from_u128(),
            content: swap_content(),
            sender_name: user.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            community_rules_accepted: None,
            channel_rules_accepted: None,
            message_filter_failed: None,
            pin: None,
            og_previews: Vec::new(),
        },
    );
    assert!(
        matches!(&channel_response, user_canister::send_message_with_transfer_to_channel::Response::Error(e) if e.matches_code(OCErrorCode::NotDiamondMember)),
        "{channel_response:?}"
    );
}

pub(crate) fn verify_swap_status<F: FnOnce(&P2PSwapStatus) -> bool>(event: ChatEvent, predicate: F) {
    let ChatEvent::Message(m) = event else {
        panic!("Event is not a message. Event: {event:?}")
    };

    let MessageContent::P2PSwap(p) = m.content else {
        panic!("Message is not a P2PSwap. Message: {:?}", m.content)
    };

    assert!(predicate(&p.status), "{:?}", p.status);
}
