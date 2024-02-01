use crate::env::ENV;
use crate::rng::{random_message_id, random_string};
use crate::utils::tick_many;
use crate::{client, TestEnv};
use candid::Principal;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use types::{ChatEvent, Cryptocurrency, MessageContent, MessageContentInitial, P2PSwapContentInitial, P2PSwapStatus};
use utils::time::{DAY_IN_MS, MINUTE_IN_MS};

#[test]
fn p2p_swap_in_direct_chat_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    client::icrc1::happy_path::transfer(
        env,
        *controller,
        canister_ids.icp_ledger,
        Principal::from(user1.user_id),
        1_100_000_000,
    );
    client::icrc1::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        Principal::from(user2.user_id),
        11_000_000_000,
    );

    let message_id = random_message_id();

    let send_message_response = client::user::send_message_v2(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::P2PSwap(P2PSwapContentInitial {
                token0: Cryptocurrency::InternetComputer.try_into().unwrap(),
                token0_amount: 1_000_000_000,
                token1: Cryptocurrency::CHAT.try_into().unwrap(),
                token1_amount: 10_000_000_000,
                expires_in: DAY_IN_MS,
                caption: None,
            }),
            replies_to: None,
            forwarding: false,
            message_filter_failed: None,
            correlation_id: 0,
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
            message_id,
        },
    );

    assert!(matches!(
        accept_offer_response,
        user_canister::accept_p2p_swap::Response::Success(_)
    ));

    tick_many(env, 10);

    assert_eq!(
        client::icrc1::happy_path::balance_of(env, canister_ids.chat_ledger, Principal::from(user1.user_id)),
        10_000_000_000
    );

    assert_eq!(
        client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, Principal::from(user2.user_id)),
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
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), true, true);
    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);

    client::icrc1::happy_path::transfer(
        env,
        *controller,
        canister_ids.icp_ledger,
        Principal::from(user1.user_id),
        1_100_000_000,
    );
    client::icrc1::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        Principal::from(user2.user_id),
        11_000_000_000,
    );

    let message_id = random_message_id();

    let send_message_response = client::user::send_message_with_transfer_to_group(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_with_transfer_to_group::Args {
            group_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::P2PSwap(P2PSwapContentInitial {
                token0: Cryptocurrency::InternetComputer.try_into().unwrap(),
                token0_amount: 1_000_000_000,
                token1: Cryptocurrency::CHAT.try_into().unwrap(),
                token1_amount: 10_000_000_000,
                expires_in: DAY_IN_MS,
                caption: None,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            correlation_id: 0,
            rules_accepted: None,
            message_filter_failed: None,
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
        },
    );

    assert!(matches!(
        accept_offer_response,
        group_canister::accept_p2p_swap::Response::Success(_)
    ));

    tick_many(env, 10);

    assert_eq!(
        client::icrc1::happy_path::balance_of(env, canister_ids.chat_ledger, Principal::from(user1.user_id)),
        10_000_000_000
    );

    assert_eq!(
        client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, Principal::from(user2.user_id)),
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

    let user1 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let original_chat_balance = 11_000_000_000;

    client::icrc1::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        Principal::from(user1.user_id),
        original_chat_balance,
    );

    let message_id = random_message_id();

    let send_message_response = client::user::send_message_v2(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::P2PSwap(P2PSwapContentInitial {
                token0: Cryptocurrency::CHAT.try_into().unwrap(),
                token0_amount: 10_000_000_000,
                token1: Cryptocurrency::InternetComputer.try_into().unwrap(),
                token1_amount: 1_000_000_000,
                expires_in: DAY_IN_MS,
                caption: None,
            }),
            replies_to: None,
            forwarding: false,
            message_filter_failed: None,
            correlation_id: 0,
        },
    );

    assert!(matches!(
        send_message_response,
        user_canister::send_message_v2::Response::TransferSuccessV2(_)
    ));

    if delete_message {
        let delete_message_response = client::user::delete_messages(
            env,
            user1.principal,
            user1.canister(),
            &user_canister::delete_messages::Args {
                user_id: user2.user_id,
                thread_root_message_index: None,
                message_ids: vec![message_id],
                correlation_id: 0,
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

    tick_many(env, 5);

    assert_eq!(
        client::icrc1::happy_path::balance_of(env, canister_ids.chat_ledger, Principal::from(user1.user_id)),
        original_chat_balance - (2 * Cryptocurrency::CHAT.fee().unwrap())
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
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), true, true);
    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);

    let original_chat_balance = 11_000_000_000;

    client::icrc1::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        Principal::from(user1.user_id),
        original_chat_balance,
    );

    let message_id = random_message_id();

    let send_message_response = client::user::send_message_with_transfer_to_group(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_with_transfer_to_group::Args {
            group_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::P2PSwap(P2PSwapContentInitial {
                token0: Cryptocurrency::CHAT.try_into().unwrap(),
                token0_amount: 10_000_000_000,
                token1: Cryptocurrency::InternetComputer.try_into().unwrap(),
                token1_amount: 1_000_000_000,
                expires_in: DAY_IN_MS,
                caption: None,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            correlation_id: 0,
            rules_accepted: None,
            message_filter_failed: None,
        },
    );

    assert!(matches!(
        send_message_response,
        user_canister::send_message_with_transfer_to_group::Response::Success(_)
    ));

    if delete_message {
        let delete_message_response = client::group::delete_messages(
            env,
            user1.principal,
            group_id.into(),
            &group_canister::delete_messages::Args {
                thread_root_message_index: None,
                message_ids: vec![message_id],
                as_platform_moderator: None,
                correlation_id: 0,
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

    tick_many(env, 5);

    assert_eq!(
        client::icrc1::happy_path::balance_of(env, canister_ids.chat_ledger, Principal::from(user1.user_id)),
        original_chat_balance - (2 * Cryptocurrency::CHAT.fee().unwrap())
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

    let user1 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let original_chat_balance = 11_000_000_000;

    client::icrc1::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        Principal::from(user1.user_id),
        original_chat_balance,
    );

    let message_id = random_message_id();

    let send_message_response = client::user::send_message_v2(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::P2PSwap(P2PSwapContentInitial {
                token0: Cryptocurrency::CHAT.try_into().unwrap(),
                token0_amount: 10_000_000_000,
                token1: Cryptocurrency::InternetComputer.try_into().unwrap(),
                token1_amount: 1_000_000_000,
                expires_in: DAY_IN_MS,
                caption: None,
            }),
            replies_to: None,
            forwarding: false,
            message_filter_failed: None,
            correlation_id: 0,
        },
    );

    assert!(matches!(
        send_message_response,
        user_canister::send_message_v2::Response::TransferSuccessV2(_)
    ));

    env.advance_time(Duration::from_millis(DAY_IN_MS));
    tick_many(env, 10);

    assert_eq!(
        client::icrc1::happy_path::balance_of(env, canister_ids.chat_ledger, Principal::from(user1.user_id)),
        original_chat_balance - (2 * Cryptocurrency::CHAT.fee().unwrap())
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

fn verify_swap_status<F: FnOnce(&P2PSwapStatus) -> bool>(event: ChatEvent, predicate: F) {
    let ChatEvent::Message(m) = event else {
        panic!("Event is not a message. Event: {event:?}")
    };

    let MessageContent::P2PSwap(p) = m.content else {
        panic!("Message is not a P2PSwap. Message: {:?}", m.content)
    };

    assert!(predicate(&p.status), "{:?}", p.status);
}
