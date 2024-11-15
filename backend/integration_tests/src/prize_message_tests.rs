use crate::env::ENV;
use crate::utils::{now_millis, now_nanos, tick_many};
use crate::{client, TestEnv};
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_from_u128, random_string};
use types::{
    icrc1, ChatEvent, CryptoTransaction, Cryptocurrency, EventIndex, MessageContent, MessageContentInitial, OptionUpdate,
    PendingCryptoTransaction, PrizeContentInitial,
};
use utils::time::{HOUR_IN_MS, MINUTE_IN_MS};

#[test]
fn prize_messages_can_be_claimed_successfully() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);
    let user3 = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &user1, random_string().as_str(), true, true);
    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);
    client::local_user_index::happy_path::join_group(env, user3.principal, canister_ids.local_user_index, group_id);

    // Send user1 some ICP
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user1.user_id, 1_000_000_000);

    let prizes = [100000, 200000];
    let token = Cryptocurrency::InternetComputer;
    let fee = token.fee().unwrap();
    let message_id = random_from_u128();

    let send_message_response = client::user::send_message_with_transfer_to_group(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::send_message_with_transfer_to_group::Args {
            group_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Prize(PrizeContentInitial {
                prizes_v2: prizes.into_iter().map(u128::from).collect(),
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
                    ledger: canister_ids.icp_ledger,
                    token,
                    amount: prizes.iter().sum::<u64>() as u128 + fee * prizes.len() as u128,
                    to: group_id.into(),
                    fee,
                    memo: None,
                    created: now_nanos(env),
                })),
                end_date: now_millis(env) + HOUR_IN_MS,
                caption: None,
                diamond_only: false,
                lifetime_diamond_only: false,
                unique_person_only: false,
                streak_only: 0,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            correlation_id: 0,
            rules_accepted: None,
            message_filter_failed: None,
            pin: None,
        },
    );

    if let user_canister::send_message_with_transfer_to_group::Response::Success(result) = send_message_response {
        client::group::happy_path::claim_prize(env, user2.principal, group_id, message_id);
        let user2_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id);
        assert_eq!(user2_balance, 200000);

        client::group::happy_path::claim_prize(env, user3.principal, group_id, message_id);
        let user3_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user3.user_id);
        assert_eq!(user3_balance, 100000);

        let events = client::group::happy_path::thread_events(
            env,
            &user1,
            group_id,
            result.message_index,
            EventIndex::default(),
            true,
            10,
            10,
        );

        let prize_claimed_events = events
            .events
            .into_iter()
            .filter_map(|e| if let ChatEvent::Message(m) = e.event { Some(m) } else { None })
            .filter(|m| matches!(m.content, MessageContent::PrizeWinner(_)))
            .count();

        assert_eq!(prize_claimed_events, 2);
    }
}

#[test_case(1; "Prize expires")]
#[test_case(2; "Message deleted")]
#[test_case(3; "Message removed due to disappearing messages")]
fn unclaimed_prizes_get_refunded(case: u32) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &user1, random_string().as_str(), true, true);

    if case == 3 {
        // Set disappearing messages to 5 minutes
        client::group::happy_path::update_group(
            env,
            user1.principal,
            group_id,
            &group_canister::update_group_v2::Args {
                events_ttl: OptionUpdate::SetToSome(5 * MINUTE_IN_MS),
                ..Default::default()
            },
        );
    }

    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);

    // Send user1 some ICP
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user1.user_id, 1_000_000_000);

    let prizes = [100000, 200000];
    let token = Cryptocurrency::InternetComputer;
    let fee = token.fee().unwrap();
    let message_id = random_from_u128();

    client::user::send_message_with_transfer_to_group(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::send_message_with_transfer_to_group::Args {
            group_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Prize(PrizeContentInitial {
                prizes_v2: prizes.into_iter().map(u128::from).collect(),
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
                    ledger: canister_ids.icp_ledger,
                    token,
                    amount: prizes.iter().sum::<u64>() as u128 + fee * prizes.len() as u128,
                    to: group_id.into(),
                    fee,
                    memo: None,
                    created: now_nanos(env),
                })),
                end_date: now_millis(env) + HOUR_IN_MS,
                caption: None,
                diamond_only: false,
                lifetime_diamond_only: false,
                unique_person_only: false,
                streak_only: 0,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            correlation_id: 0,
            rules_accepted: None,
            message_filter_failed: None,
            pin: None,
        },
    );

    client::group::happy_path::claim_prize(env, user2.principal, group_id, message_id);

    let interval = match case {
        1 => HOUR_IN_MS,
        2 => {
            client::group::happy_path::delete_messages(env, user1.principal, group_id, None, vec![message_id]);
            5 * MINUTE_IN_MS
        }
        3 => 5 * MINUTE_IN_MS,
        _ => unreachable!(),
    };

    env.advance_time(Duration::from_millis(interval - 1));
    tick_many(env, 3);

    let user1_balance_before_refund = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user1.user_id);

    env.advance_time(Duration::from_millis(1));
    tick_many(env, 3);

    let user1_balance_after_refund = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user1.user_id);

    assert_eq!(user1_balance_after_refund, user1_balance_before_refund + 100000);
}

#[test]
fn old_transactions_fixed_by_updating_created_date() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &user, random_string().as_str(), true, true);

    let starting_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user.user_id);

    // Send user1 some ICP
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user.user_id, 200_000);

    let prizes = [100_000];
    let token = Cryptocurrency::InternetComputer;
    let fee = token.fee().unwrap();
    let message_id = random_from_u128();

    let send_message_response = client::user::send_message_with_transfer_to_group(
        env,
        user.principal,
        user.user_id.into(),
        &user_canister::send_message_with_transfer_to_group::Args {
            group_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Prize(PrizeContentInitial {
                prizes_v2: prizes.into_iter().map(u128::from).collect(),
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
                    ledger: canister_ids.icp_ledger,
                    token,
                    amount: prizes.iter().sum::<u64>() as u128 + fee * prizes.len() as u128,
                    to: group_id.into(),
                    fee,
                    memo: None,
                    created: now_nanos(env),
                })),
                end_date: now_millis(env) + HOUR_IN_MS,
                caption: None,
                diamond_only: false,
                lifetime_diamond_only: false,
                unique_person_only: false,
                streak_only: 0,
            }),
            sender_name: user.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            correlation_id: 0,
            rules_accepted: None,
            message_filter_failed: None,
            pin: None,
        },
    );

    assert!(matches!(
        send_message_response,
        user_canister::send_message_with_transfer_to_group::Response::Success(_)
    ));
    client::stop_canister(env, *controller, canister_ids.icp_ledger);
    env.advance_time(Duration::from_millis(HOUR_IN_MS + 1));
    tick_many(env, 3);
    client::start_canister(env, *controller, canister_ids.icp_ledger);

    let user_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user.user_id);
    assert_eq!(user_balance, starting_balance + 80_000);

    env.advance_time(Duration::from_millis(MINUTE_IN_MS + 1));
    tick_many(env, 3);

    let user_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user.user_id);
    assert_eq!(user_balance, starting_balance + 180_000);
}
