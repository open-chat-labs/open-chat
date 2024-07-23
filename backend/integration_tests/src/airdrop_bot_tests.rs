use crate::env::ENV;
use crate::utils::now_millis;
use crate::{client, TestEnv};
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::SystemTime;
use types::TimestampMillis;

const DAY_ZERO: TimestampMillis = 1704067200000; // Mon Jan 01 2024 00:00:00 GMT+0000

#[test]
fn airdrop_end_to_end() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user_count = 5usize;
    let users: Vec<_> = (0..user_count).map(|_| client::register_user(env, canister_ids)).collect();

    ensure_time_at_least_day0(env);

    let diamond_user = client::register_diamond_user(env, canister_ids, *controller);

    let community_id = client::user::happy_path::create_community(
        env,
        &diamond_user,
        "CHIT for CHAT airdrops",
        true,
        vec!["General".to_string()],
    );

    env.tick();

    for user in users {
        client::local_user_index::happy_path::join_community(env, user.principal, canister_ids.local_user_index, community_id);
        client::user::happy_path::claim_daily_chit(env, &user);
    }

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.chat_ledger,
        canister_ids.airdrop_bot,
        10_000_100_000_000,
    );

    let _channel_id = client::community::happy_path::create_channel(
        env,
        diamond_user.principal,
        community_id,
        true,
        "July airdrop".to_string(),
    );

    // - Promote airdrop bot to channel owner
    // - Call set_airdrop
    // - Check the channel now has AccessGate::Locked
    // - Check the channel now has exactly 3 prize messages
    // - Check a user has a DM with expected prize
}

fn ensure_time_at_least_day0(env: &mut PocketIc) {
    if now_millis(env) < DAY_ZERO {
        env.set_time(SystemTime::now());
    }
}
