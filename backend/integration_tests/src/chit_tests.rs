use types::ChitEarnedReason;

use crate::env::ENV;
use crate::{client, TestEnv};
use std::ops::Deref;
use std::time::SystemTime;

#[test]
fn claim_daily_chit_logged_in_user_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    env.set_time(SystemTime::now());

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
