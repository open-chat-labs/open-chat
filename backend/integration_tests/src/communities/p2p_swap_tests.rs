use crate::env::ENV;
use crate::p2p_swap_tests::verify_swap_status;
use crate::utils::tick_many;
use crate::{client, TestEnv};
use candid::Principal;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_from_u128, random_string};
use types::{Cryptocurrency, MessageContentInitial, P2PSwapContentInitial, P2PSwapStatus};
use utils::time::{DAY_IN_MS, MINUTE_IN_MS};

#[test]
fn p2p_swap_in_channel_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);

    let community_id = client::user::happy_path::create_community(env, &user1, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::summary(env, &user1, community_id)
        .channels
        .first()
        .unwrap()
        .channel_id;

    client::local_user_index::happy_path::join_community(
        env,
        user2.principal,
        canister_ids.local_user_index,
        community_id,
        None,
    );

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.icp_ledger,
        Principal::from(user1.user_id),
        1_100_000_000,
    );
    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        Principal::from(user2.user_id),
        11_000_000_000,
    );

    let message_id = random_from_u128();

    let send_message_response = client::user::send_message_with_transfer_to_channel(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_with_transfer_to_channel::Args {
            community_id,
            channel_id,
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
            block_level_markdown: false,
            community_rules_accepted: None,
            channel_rules_accepted: None,
            message_filter_failed: None,
            pin: None,
        },
    );

    assert!(matches!(
        send_message_response,
        user_canister::send_message_with_transfer_to_channel::Response::Success(_)
    ));

    let accept_offer_response = client::community::accept_p2p_swap(
        env,
        user2.principal,
        community_id.into(),
        &community_canister::accept_p2p_swap::Args {
            channel_id,
            thread_root_message_index: None,
            message_id,
            pin: None,
            new_achievement: false,
        },
    );

    assert!(matches!(
        accept_offer_response,
        community_canister::accept_p2p_swap::Response::Success(_)
    ));

    tick_many(env, 10);

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, Principal::from(user1.user_id)),
        10_000_000_000
    );

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, Principal::from(user2.user_id)),
        1_000_000_000
    );

    let event = client::community::happy_path::events_by_index(env, &user1, community_id, channel_id, vec![2.into()])
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
fn cancel_p2p_swap_in_channel_succeeds(delete_message: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);

    let community_id = client::user::happy_path::create_community(env, &user1, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::summary(env, &user1, community_id)
        .channels
        .first()
        .unwrap()
        .channel_id;
    client::local_user_index::happy_path::join_community(
        env,
        user2.principal,
        canister_ids.local_user_index,
        community_id,
        None,
    );

    let original_chat_balance = 11_000_000_000;

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        Principal::from(user1.user_id),
        original_chat_balance,
    );

    let message_id = random_from_u128();

    let send_message_response = client::user::send_message_with_transfer_to_channel(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_with_transfer_to_channel::Args {
            community_id,
            channel_id,
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
            block_level_markdown: false,
            community_rules_accepted: None,
            channel_rules_accepted: None,
            message_filter_failed: None,
            pin: None,
        },
    );

    assert!(matches!(
        send_message_response,
        user_canister::send_message_with_transfer_to_channel::Response::Success(_)
    ));

    if delete_message {
        let delete_message_response = client::community::delete_messages(
            env,
            user1.principal,
            community_id.into(),
            &community_canister::delete_messages::Args {
                channel_id,
                thread_root_message_index: None,
                message_ids: vec![message_id],
                as_platform_moderator: None,
                new_achievement: false,
            },
        );

        assert!(matches!(
            delete_message_response,
            community_canister::delete_messages::Response::Success
        ));

        env.advance_time(Duration::from_millis(5 * MINUTE_IN_MS));
    } else {
        let cancel_swap_response = client::community::cancel_p2p_swap(
            env,
            user1.principal,
            community_id.into(),
            &community_canister::cancel_p2p_swap::Args {
                channel_id,
                thread_root_message_index: None,
                message_id,
            },
        );

        assert!(matches!(
            cancel_swap_response,
            community_canister::cancel_p2p_swap::Response::Success
        ));
    }

    tick_many(env, 5);

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, Principal::from(user1.user_id)),
        original_chat_balance - (2 * Cryptocurrency::CHAT.fee().unwrap())
    );

    if !delete_message {
        let event = client::community::happy_path::events_by_index(env, &user1, community_id, channel_id, vec![2.into()])
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
