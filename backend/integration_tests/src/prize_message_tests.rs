use crate::env::ENV;
use crate::utils::{now_millis, now_nanos, tick_many};
use crate::{TestEnv, User, client};
use constants::{DAY_IN_MS, HOUR_IN_MS, ICP_SYMBOL, ICP_TRANSFER_FEE, MINUTE_IN_MS, PRIZE_FEE_PERCENT};
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_from_u128, random_string};
use types::{
    CanisterId, ChatEvent, ChatId, CryptoTransaction, EventIndex, MessageContent, MessageContentInitial, MessageId,
    Milliseconds, MultiUserChat, OptionUpdate, PendingCryptoTransaction, PrizeContentInitial, UserId, icrc1,
};

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
    client::group::happy_path::join_group(env, user2.principal, group_id);
    client::group::happy_path::join_group(env, user3.principal, group_id);

    // Send user1 some ICP
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, &user1, 1_000_000_000);

    let prizes = [100000, 200000];
    let fee = ICP_TRANSFER_FEE;
    let message_id = random_from_u128();

    let send_message_response = client::group::send_message_with_transfer(
        env,
        &user1,
        group_id,
        group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Prize(PrizeContentInitial {
                prizes_v2: prizes.into_iter().map(u128::from).collect(),
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
                    ledger: canister_ids.icp_ledger,
                    token_symbol: ICP_SYMBOL.to_string(),
                    amount: prize_amount(&prizes, fee),
                    to: CanisterId::from(group_id).into(),
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
                min_chit_earned: 0,
                min_account_age: None,
                excluded_users: None,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            forwarding: false,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );

    assert!(
        matches!(send_message_response, group_canister::send_message_v2::Response::Success(_)),
        "{send_message_response:?}"
    );
    if let group_canister::send_message_v2::Response::Success(result) = send_message_response {
        let local_user_index = canister_ids.local_user_index(env, group_id);

        client::local_user_index::happy_path::claim_prize(
            env,
            user2.principal,
            local_user_index,
            MultiUserChat::Group(group_id),
            message_id,
        );
        let user2_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user2);
        assert_eq!(user2_balance, 200000);

        client::local_user_index::happy_path::claim_prize(
            env,
            user3.principal,
            local_user_index,
            MultiUserChat::Group(group_id),
            message_id,
        );
        let user3_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user3);
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

    client::group::happy_path::join_group(env, user2.principal, group_id);

    // Send user1 some ICP
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, &user1, 1_000_000_000);

    let prizes = vec![100000, 200000];
    let fee = ICP_TRANSFER_FEE;
    let total = prizes.iter().sum::<u128>();
    let amount = total + (fee * prizes.len() as u128) + (total * PRIZE_FEE_PERCENT as u128 / 100);
    let message_id = random_from_u128();

    client::group::send_message_with_transfer(
        env,
        &user1,
        group_id,
        group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Prize(PrizeContentInitial {
                prizes_v2: prizes,
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
                    ledger: canister_ids.icp_ledger,
                    token_symbol: ICP_SYMBOL.to_string(),
                    amount,
                    to: CanisterId::from(group_id).into(),
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
                min_chit_earned: 0,
                min_account_age: None,
                excluded_users: None,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            forwarding: false,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );

    let local_user_index = canister_ids.local_user_index(env, group_id);
    client::local_user_index::happy_path::claim_prize(
        env,
        user2.principal,
        local_user_index,
        MultiUserChat::Group(group_id),
        message_id,
    );

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

    let user1_balance_before_refund = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user1);

    env.advance_time(Duration::from_millis(1));
    tick_many(env, 3);

    let user1_balance_after_refund = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user1);

    assert_eq!(user1_balance_after_refund, user1_balance_before_refund + 105000);
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

    let starting_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user);

    // Send user1 some ICP
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, &user, 200_000);

    let prizes = vec![100_000];
    let fee = ICP_TRANSFER_FEE;
    let total = prizes.iter().sum::<u128>();
    let amount = total + (fee * prizes.len() as u128) + (total * PRIZE_FEE_PERCENT as u128 / 100);
    let message_id = random_from_u128();

    let send_message_response = client::group::send_message_with_transfer(
        env,
        &user,
        group_id,
        group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Prize(PrizeContentInitial {
                prizes_v2: prizes,
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
                    ledger: canister_ids.icp_ledger,
                    token_symbol: ICP_SYMBOL.to_string(),
                    amount,
                    to: CanisterId::from(group_id).into(),
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
                min_chit_earned: 0,
                min_account_age: None,
                excluded_users: None,
            }),
            sender_name: user.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            forwarding: false,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );

    assert!(
        matches!(send_message_response, group_canister::send_message_v2::Response::Success(_)),
        "{send_message_response:?}"
    );
    client::stop_canister(env, *controller, canister_ids.icp_ledger);
    env.advance_time(Duration::from_millis(HOUR_IN_MS + 1));
    tick_many(env, 3);
    client::start_canister(env, *controller, canister_ids.icp_ledger);

    // The user paid the prize and the fee for transferring it, plus the fee for approving the group to
    // pull it
    let user_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user);
    assert_eq!(user_balance, starting_balance + 75_000 - ICP_TRANSFER_FEE);

    env.advance_time(Duration::from_millis(MINUTE_IN_MS + 1));
    tick_many(env, 3);

    // The unclaimed prize was refunded, less the fee for refunding it
    let user_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user);
    assert_eq!(user_balance, starting_balance + 180_000 - ICP_TRANSFER_FEE);
}

// Invariants: a claim on a prize with a minimum account age succeeds only from an account at least
// that old, whose registration date reaches the chat's LocalUserIndex from another subnet's; an
// excluded user is refused as not eligible, like any other ineligible claimer, and the prize stays
// claimable by others
#[test]
fn prize_claims_respect_minimum_account_age_and_exclusions() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &user1, random_string().as_str(), true, true);
    let group_subnet = env.get_subnet(group_id.into()).unwrap();
    let other_subnet = canister_ids
        .subnets
        .iter()
        .map(|s| s.subnet_id)
        .find(|s| *s != group_subnet)
        .unwrap();

    // Registered on another subnet, so their dates reach the group's LocalUserIndex from the UserIndex
    let old_user = client::register_user_on_subnet(env, canister_ids, other_subnet);
    let excluded_user = client::register_user_on_subnet(env, canister_ids, other_subnet);
    env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
    let young_user = client::register_user_on_subnet(env, canister_ids, other_subnet);
    tick_many(env, 10);

    for user in [&old_user, &excluded_user, &young_user] {
        client::group::happy_path::join_group(env, user.principal, group_id);
    }

    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, &user1, 1_000_000_000);
    let message_id = send_prize_message(
        env,
        canister_ids.icp_ledger,
        &user1,
        group_id,
        Some(DAY_IN_MS),
        Some(vec![excluded_user.user_id]),
    );

    let local_user_index = canister_ids.local_user_index(env, group_id);
    let chat_id = MultiUserChat::Group(group_id);
    for user in [&young_user, &excluded_user] {
        let response = client::local_user_index::claim_prize(
            env,
            user.principal,
            local_user_index,
            &local_user_index_canister::claim_prize::Args { chat_id, message_id },
        );
        assert!(
            matches!(&response, local_user_index_canister::claim_prize::Response::Error(e)
                if e.matches_code(OCErrorCode::PrizeUserNotElligible) && e.message().is_none()),
            "{response:?}"
        );
    }

    client::local_user_index::happy_path::claim_prize(env, old_user.principal, local_user_index, chat_id, message_id);
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &old_user),
        10_000
    );
}

// Sends a prize message with two prizes, which can be claimed for two days
fn send_prize_message(
    env: &mut PocketIc,
    ledger: CanisterId,
    sender: &User,
    group_id: ChatId,
    min_account_age: Option<Milliseconds>,
    excluded_users: Option<Vec<UserId>>,
) -> MessageId {
    let prizes = [10_000, 10_000];
    let fee = ICP_TRANSFER_FEE;
    let message_id = random_from_u128();

    let response = client::group::send_message_with_transfer(
        env,
        sender,
        group_id,
        group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Prize(PrizeContentInitial {
                prizes_v2: prizes.into_iter().map(u128::from).collect(),
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
                    ledger,
                    token_symbol: ICP_SYMBOL.to_string(),
                    amount: prize_amount(&prizes, fee),
                    to: CanisterId::from(group_id).into(),
                    fee,
                    memo: None,
                    created: now_nanos(env),
                })),
                end_date: now_millis(env) + 2 * DAY_IN_MS,
                caption: None,
                diamond_only: false,
                lifetime_diamond_only: false,
                unique_person_only: false,
                streak_only: 0,
                min_chit_earned: 0,
                min_account_age,
                excluded_users,
            }),
            sender_name: sender.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            forwarding: false,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );
    assert!(
        matches!(response, group_canister::send_message_v2::Response::Success(_)),
        "{response:?}"
    );
    message_id
}

// What a prize message's transfer must hold: the prizes, a transfer fee for paying out each one and
// OpenChat's fee
fn prize_amount(prizes: &[u64], fee: u128) -> u128 {
    let total = prizes.iter().sum::<u64>() as u128;
    total + fee * prizes.len() as u128 + total * PRIZE_FEE_PERCENT as u128 / 100
}
