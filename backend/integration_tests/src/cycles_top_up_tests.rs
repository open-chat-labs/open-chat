use crate::env::ENV;
use crate::utils::{liquid_cycle_balance, set_freezing_threshold, tick_many};
use crate::{TestEnv, client};
use candid::Nat;
use constants::B;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::CanisterId;
use utils::cycles::{MIN_CYCLES_BALANCE, is_cycles_balance_low};

// The LocalUserIndex checks each of its canisters' balances weekly, topping up one which is low by
// enough to bring it back to the minimum, plus the usual amount. The group here is frozen, so it
// can't ask to be topped up itself.
#[test]
fn weekly_check_tops_up_a_low_canister_back_to_its_minimum() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), false, true);
    let canister_id = CanisterId::from(group_id);
    let local_user_index = canister_ids.local_user_index(env, canister_id);

    // Raise the freezing threshold until the cycles it reserves are above the balance, by more than
    // the usual top up. That freezes the group, leaving it short by more than twice the reserve.
    let balance = env.cycle_balance(canister_id);
    let status = env.canister_status(canister_id, Some(local_user_index)).unwrap();
    let original_freezing_threshold = status.settings.freezing_threshold.clone();
    let burned_per_day = to_u128(&status.idle_cycles_burned_per_day);
    assert!(burned_per_day > 0);
    let freezing_threshold_secs = (balance + 600 * B) * 24 * 60 * 60 / burned_per_day;
    set_freezing_threshold(env, canister_id, local_user_index, freezing_threshold_secs.into());

    // A check already under way (this environment is shared with other tests) won't include the
    // group, in which case it is picked up by the following one
    let mut topped_up = false;
    'outer: for _ in 0..3 {
        env.advance_time(Duration::from_secs(8 * 24 * 60 * 60));
        for _ in 0..3000 {
            env.tick();
            if env.cycle_balance(canister_id) > balance {
                topped_up = true;
                break 'outer;
            }
        }
    }
    assert!(topped_up, "The group was not topped up");

    // By enough for its balance no longer to be low, rather than by the usual amount alone
    tick_many(env, 5);
    let cycles_balance = env.cycle_balance(canister_id);
    let liquid = liquid_cycle_balance(env, canister_id, local_user_index);
    assert!(!is_cycles_balance_low(
        cycles_balance,
        cycles_balance - liquid,
        MIN_CYCLES_BALANCE
    ));

    // Put the freezing threshold back, since the environment, and so this group, is shared with
    // later tests
    set_freezing_threshold(env, canister_id, local_user_index, original_freezing_threshold);
}

fn to_u128(nat: &Nat) -> u128 {
    nat.0.clone().try_into().unwrap()
}
