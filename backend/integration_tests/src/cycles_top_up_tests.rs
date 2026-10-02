use crate::env::ENV;
use crate::utils::set_freezing_threshold;
use crate::{TestEnv, client};
use candid::Nat;
use constants::B;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::CanisterId;
use utils::cycles::{MIN_CYCLES_BALANCE, freeze_threshold_cycles, is_cycles_balance_low};

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

    // Raise the freezing threshold until the cycles it reserves are just above the balance. That
    // freezes the group, and leaves it short by twice the reserve, far more than the usual top up.
    let balance = env.cycle_balance(canister_id);
    let status = env.canister_status(canister_id, Some(local_user_index)).unwrap();
    let original_freezing_threshold = status.settings.freezing_threshold.clone();
    let burned_per_day = to_u128(&status.idle_cycles_burned_per_day);
    assert!(burned_per_day > 0);
    let freezing_threshold_secs = (balance + 50 * B) * 24 * 60 * 60 / burned_per_day;
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

    // By twice the reserve, plus the usual amount, rather than by the usual amount alone
    assert!(env.cycle_balance(canister_id) > 3 * balance);
    let status = env.canister_status(canister_id, Some(local_user_index)).unwrap();
    let freeze_threshold = freeze_threshold_cycles(
        to_u128(&status.idle_cycles_burned_per_day),
        status.settings.freezing_threshold.0.clone().try_into().unwrap(),
        to_u128(&status.reserved_cycles),
    );
    assert!(!is_cycles_balance_low(
        to_u128(&status.cycles),
        freeze_threshold,
        MIN_CYCLES_BALANCE
    ));

    set_freezing_threshold(env, canister_id, local_user_index, original_freezing_threshold);

    // The clock has jumped by weeks
    wrapper.discard();
}

fn to_u128(nat: &Nat) -> u128 {
    nat.0.clone().try_into().unwrap()
}
