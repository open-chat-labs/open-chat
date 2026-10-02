use crate::env::ENV;
use crate::utils::{liquid_cycle_balance, metrics, set_freezing_threshold, tick_many};
use crate::{TestEnv, client};
use candid::Nat;
use constants::B;
use std::ops::Deref;
use std::time::Duration;
use types::CanisterId;
use utils::cycles::{MIN_CYCLES_BALANCE, USER_CANISTER_MIN_CYCLES_BALANCE};

// User canisters are being migrated into MultiUser canisters, so the LocalUserIndex's weekly check
// holds them to about their old minimum rather than topping each up towards the 1T other canisters
// keep. A frozen User canister on the same LocalUserIndex shows when a check has run.
#[test]
fn weekly_check_holds_user_canisters_to_their_old_minimum() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let local_user_index = user.local_user_index;
    let frozen_user = client::register_user_with_referrer_on(env, canister_ids, local_user_index, None);

    // Once the cycles its freezing threshold reserves are set aside, it holds less than the 1T other
    // canisters keep, but more than the User canister minimum, with room for what it burns while idle
    // over the weeks the clock is moved on below
    let balance = env.cycle_balance(user.canister());
    let liquid = liquid_cycle_balance(env, user.canister(), local_user_index);
    assert!(liquid < MIN_CYCLES_BALANCE);
    assert!(liquid > USER_CANISTER_MIN_CYCLES_BALANCE + 50 * B, "{liquid}");

    // Raise the frozen user's freezing threshold until the cycles it reserves are just above its
    // balance, so it can't ask to be topped up itself
    let frozen_balance = env.cycle_balance(frozen_user.canister());
    let status = env.canister_status(frozen_user.canister(), Some(local_user_index)).unwrap();
    let original_freezing_threshold = status.settings.freezing_threshold.clone();
    let burned_per_day = to_u128(&status.idle_cycles_burned_per_day);
    assert!(burned_per_day > 0);
    let freezing_threshold_secs = (frozen_balance + 50 * B) * 24 * 60 * 60 / burned_per_day;
    set_freezing_threshold(env, frozen_user.canister(), local_user_index, freezing_threshold_secs.into());

    // Wait for a check which tops up the frozen user's canister, then for it to work through the rest
    // of the queue. A check already under way (this environment is shared with other tests) may not
    // include it, in which case it is picked up by the following one.
    let mut checked = false;
    'outer: for _ in 0..3 {
        env.advance_time(Duration::from_secs(8 * 24 * 60 * 60));
        for _ in 0..3000 {
            env.tick();
            if env.cycle_balance(frozen_user.canister()) > frozen_balance + 150 * B
                && check_queue_length(env, local_user_index) == 0
            {
                checked = true;
                break 'outer;
            }
        }
    }
    assert!(checked, "The frozen user's canister was not topped up");

    // The queue empties as the last canister in it is taken, before that canister's top up (if any)
    // has landed
    tick_many(env, 10);

    // The other user's canister, above its old minimum, was left alone
    assert!(env.cycle_balance(user.canister()) <= balance);

    // Put the freezing threshold back, since the environment, and so this canister, is shared with
    // later tests
    set_freezing_threshold(env, frozen_user.canister(), local_user_index, original_freezing_threshold);
}

fn check_queue_length(env: &pocket_ic::PocketIc, local_user_index: CanisterId) -> u64 {
    metrics(env, local_user_index)["cycles_balance_check_queue_len"]
        .as_u64()
        .unwrap()
}

fn to_u128(nat: &Nat) -> u128 {
    nat.0.clone().try_into().unwrap()
}
