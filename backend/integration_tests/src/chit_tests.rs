use crate::env::ENV;
use crate::utils::now_millis;
use crate::{client, TestEnv, User};
use constants::DAY_IN_MS;
use pocket_ic::PocketIc;
use std::cmp::max;
use std::ops::{Add, Deref};
use std::time::{Duration, SystemTime};
use test_case::test_case;
use types::{ChitEarnedReason, TimestampMillis};
use utils::time::MonthKey;

const DAY_ZERO: TimestampMillis = 1704067200000; // Mon Jan 01 2024 00:00:00 GMT+0000

#[test]
fn claim_daily_chit_reflected_in_user_index() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);
    ensure_time_at_least_day0(env);

    let result = client::user::happy_path::claim_daily_chit(env, &user);
    assert_eq!(result.chit_balance, 200);
    assert_eq!(result.chit_earned, 200);
    assert_eq!(result.streak, 1);

    let events = client::user::happy_path::chit_events(env, &user, None, None, 10);
    assert_eq!(events.total, 1);
    assert_eq!(events.events.len(), 1);
    assert_eq!(events.events[0].amount, 200);
    assert!(matches!(events.events[0].reason, ChitEarnedReason::DailyClaim));

    env.tick();

    let result = client::user_index::happy_path::users(env, user2.principal, canister_ids.user_index, vec![user.user_id]);

    assert_eq!(result.users.len(), 1);

    let user1_summary = result.users[0].volatile.as_ref().unwrap();

    assert_eq!(user1_summary.chit_balance, 200);
    assert_eq!(user1_summary.streak, 1);
    assert_eq!(user1_summary.max_streak, 1);
}

#[test]
fn chit_streak_gained_and_lost_as_expected() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);
    ensure_time_at_least_day0(env);

    let result = client::user::happy_path::claim_daily_chit(env, &user);
    assert_eq!(result.streak, 1);

    env.advance_time(Duration::from_millis(DAY_IN_MS));
    let result = client::user::happy_path::claim_daily_chit(env, &user);
    assert_eq!(result.streak, 2);

    env.advance_time(Duration::from_millis(DAY_IN_MS));
    let result = client::user::happy_path::claim_daily_chit(env, &user);
    assert_eq!(result.streak, 3);

    env.advance_time(Duration::from_millis(DAY_IN_MS));
    let result = client::user::happy_path::claim_daily_chit(env, &user);
    assert_eq!(result.streak, 4);

    env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
    env.tick();

    let result = client::user::happy_path::initial_state(env, &user);
    assert_eq!(result.streak, 0);

    env.tick();

    let result = client::user_index::happy_path::users(env, user2.principal, canister_ids.user_index, vec![user.user_id]);

    assert_eq!(result.users.len(), 1);
    assert_eq!(result.users[0].volatile.as_ref().unwrap().streak, 0);
    assert_eq!(result.users[0].volatile.as_ref().unwrap().max_streak, 4);
}

#[test]
fn chit_stored_per_month() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    ensure_time_at_least_day0(env);
    advance_to_next_month(env);
    let start_month = MonthKey::from_timestamp(now_millis(env));

    for i in 1..5 {
        for _ in 0..i {
            client::user::happy_path::claim_daily_chit(env, &user);
            env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
        }
        advance_to_next_month(env);
    }

    env.tick();

    let mut month = start_month;
    for i in 1..5 {
        let chit = client::user_index::happy_path::users_chit(
            env,
            canister_ids.user_index,
            vec![user.user_id],
            month.year() as u16,
            month.month(),
        )
        .values()
        .next()
        .cloned()
        .unwrap();

        assert_eq!(chit.balance, i * 200);

        month = month.next();
    }

    let user = client::user_index::happy_path::user(env, canister_ids.user_index, user.user_id);

    assert_eq!(user.total_chit_earned, 2000);
    assert_eq!(user.chit_balance, 0);
}

#[test_case(0)]
#[test_case(1)]
#[test_case(2)]
#[test_case(3)]
fn chit_streak_maintained_if_insured(days_insured: u8) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    ensure_time_at_least_day0(env);

    claim_then_check_result(env, &user, 1, 1);

    const ONE_CHAT: u128 = 100_000_000;
    client::ledger::happy_path::transfer(env, *controller, canister_ids.chat_ledger, user.user_id, 100 * ONE_CHAT);

    let expected_price = (2u128.pow(days_insured as u32) - 1) * ONE_CHAT;

    if days_insured > 0 {
        let pay_for_insurance_response = client::user::pay_for_streak_insurance(
            env,
            user.principal,
            user.canister(),
            &user_canister::pay_for_streak_insurance::Args {
                additional_days: days_insured,
                expected_price,
            },
        );
        assert!(
            matches!(
                pay_for_insurance_response,
                user_canister::pay_for_streak_insurance::Response::Success
            ),
            "{pay_for_insurance_response:?}"
        );
    }

    let result = client::user::happy_path::initial_state(env, &user);
    assert_eq!(
        result.streak_insurance.map(|s| s.days_insured).unwrap_or_default(),
        days_insured
    );

    env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
    env.tick();
    let insured = days_insured >= 1;

    let mut expected_streak = if insured { 2 } else { 0 };
    let mut expected_max_streak = max(expected_streak, 1);
    assert_streak_lengths(env, &user, expected_streak, expected_max_streak);

    expected_streak += 1;
    expected_max_streak = max(expected_streak, expected_max_streak);
    claim_then_check_result(env, &user, expected_streak, expected_max_streak);

    env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
    env.tick();
    let insured = days_insured >= 2;

    expected_streak = if insured { 4 } else { 0 };
    expected_max_streak = max(expected_streak, expected_max_streak);
    assert_streak_lengths(env, &user, expected_streak, expected_max_streak);

    expected_streak += 1;
    expected_max_streak = max(expected_streak, expected_max_streak);
    claim_then_check_result(env, &user, expected_streak, expected_max_streak);

    env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
    env.tick();
    let insured = days_insured >= 3;

    expected_streak = if insured { 6 } else { 0 };
    expected_max_streak = max(expected_streak, expected_max_streak);
    assert_streak_lengths(env, &user, expected_streak, expected_max_streak);

    expected_streak += 1;
    expected_max_streak = max(expected_streak, expected_max_streak);
    claim_then_check_result(env, &user, expected_streak, expected_max_streak);

    env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
    env.tick();
    let insured = days_insured >= 4;

    expected_streak = if insured { 6 } else { 0 };
    expected_max_streak = max(expected_streak, expected_max_streak);
    assert_streak_lengths(env, &user, expected_streak, expected_max_streak);

    expected_streak += 1;
    expected_max_streak = max(expected_streak, expected_max_streak);
    claim_then_check_result(env, &user, expected_streak, expected_max_streak);

    env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
    env.tick();

    let result = client::user::happy_path::initial_state(env, &user);
    assert!(result.streak_insurance.is_none());
}

fn advance_to_next_month(env: &mut PocketIc) {
    let now = now_millis(env);
    let next_month = MonthKey::from_timestamp(now).next();
    env.set_time(SystemTime::UNIX_EPOCH.add(Duration::from_millis(next_month.start_timestamp())));
}

fn ensure_time_at_least_day0(env: &mut PocketIc) {
    if now_millis(env) < DAY_ZERO {
        env.set_time(SystemTime::now());
    }
}

fn assert_streak_lengths(env: &PocketIc, user: &User, streak: u16, max_streak: u16) {
    let initial_state = client::user::happy_path::initial_state(env, user);
    assert_eq!(initial_state.streak, streak);
    assert_eq!(initial_state.max_streak, max_streak);
}

fn claim_then_check_result(env: &mut PocketIc, user: &User, streak: u16, max_streak: u16) {
    let result = client::user::happy_path::claim_daily_chit(env, user);
    assert_eq!(result.streak, streak);
    assert_eq!(result.max_streak, max_streak);
}
