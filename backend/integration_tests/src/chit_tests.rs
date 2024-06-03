use pocket_ic::PocketIc;
use types::{ChitEarnedReason, Milliseconds, TimestampMillis};

use crate::env::ENV;
use crate::utils::now_millis;
use crate::{client, TestEnv};
use std::ops::Deref;
use std::time::{Duration, SystemTime};

const DAY_ZERO: TimestampMillis = 1704067200000; // Mon Jan 01 2024 00:00:00 GMT+0000
const MS_IN_DAY: Milliseconds = 1000 * 60 * 60 * 24;

#[test]
fn claim_daily_chit_logged_in_user_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    ensure_time_at_least_day0(env);

    let result = client::user_index::happy_path::claim_daily_chit(env, user.principal, canister_ids.user_index);

    assert_eq!(result.chit_balance, 200);
    assert_eq!(result.chit_earned, 200);
    assert_eq!(result.streak, 1);

    let current_user = client::user_index::happy_path::current_user(env, user.principal, canister_ids.user_index);

    assert_eq!(current_user.chit_balance, 200);
    assert_eq!(current_user.streak, 1);
    assert_eq!(current_user.next_daily_claim, result.next_claim);

    env.tick();

    let events = client::user::happy_path::chit_events(env, &user, None, 10);
    assert_eq!(events.total, 1);
    assert_eq!(events.events.len(), 1);
    assert_eq!(events.events[0].amount, 200);
    assert!(matches!(events.events[0].reason, ChitEarnedReason::DailyClaim));
}

#[test]
fn chit_streak_gained_and_lost_as_expected() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    ensure_time_at_least_day0(env);

    let result = client::user_index::happy_path::claim_daily_chit(env, user.principal, canister_ids.user_index);
    assert_eq!(result.chit_balance, 200);
    assert_eq!(result.streak, 1);

    env.advance_time(Duration::from_millis(MS_IN_DAY));
    let result = client::user_index::happy_path::claim_daily_chit(env, user.principal, canister_ids.user_index);
    assert_eq!(result.chit_balance, 400);
    assert_eq!(result.streak, 2);

    env.advance_time(Duration::from_millis(MS_IN_DAY));
    let result = client::user_index::happy_path::claim_daily_chit(env, user.principal, canister_ids.user_index);
    assert_eq!(result.chit_balance, 700);
    assert_eq!(result.streak, 3);

    env.advance_time(Duration::from_millis(MS_IN_DAY));
    let result = client::user_index::happy_path::claim_daily_chit(env, user.principal, canister_ids.user_index);
    assert_eq!(result.chit_balance, 1000);
    assert_eq!(result.streak, 4);

    env.advance_time(Duration::from_millis(2 * MS_IN_DAY));
    env.tick();
    let current_user = client::user_index::happy_path::current_user(env, user.principal, canister_ids.user_index);
    assert_eq!(result.chit_balance, 1000);
    assert_eq!(current_user.streak, 0);
}

fn ensure_time_at_least_day0(env: &mut PocketIc) {
    if now_millis(env) < DAY_ZERO {
        env.set_time(SystemTime::now());
    }
}
