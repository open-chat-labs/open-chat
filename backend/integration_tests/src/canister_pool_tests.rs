use crate::delete_user_tests::{MAX_RESIDUAL_CYCLES, wait_for_refund_queue_to_empty};
use crate::env::ENV;
use crate::utils::metrics;
use crate::{TestEnv, client, wasms};
use candid::Principal;
use constants::B;
use local_user_index_canister::UserIndexEvent;
use pocket_ic::{CanisterSettings, PocketIc};
use std::ops::Deref;
use std::time::Duration;
use types::{CanisterId, SuccessOnly};

// Upgrading the LocalUserIndex refunds the cycles of the canisters in its pool and puts them back,
// though not one it doesn't control. A canister taken from the pool is then topped up and given the
// IC's default freezing threshold as it is used.
#[test]
fn pool_canisters_are_refunded_then_topped_up_when_used() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let pool_canister = create_empty_canister(env, local_user_index, local_user_index);
    let uncontrolled_canister = create_empty_canister(env, local_user_index, *controller);

    // The pool never fills in the tests, so the canisters are put into it as the UserIndex once did
    let response = client::local_user_index::c2c_notify_user_index_events(
        env,
        canister_ids.user_index,
        local_user_index,
        &local_user_index_canister::c2c_notify_user_index_events::Args {
            events: vec![
                UserIndexEvent::AddCanisterToPool(pool_canister),
                UserIndexEvent::AddCanisterToPool(uncontrolled_canister),
            ],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));
    assert_eq!(canisters_in_pool(env, local_user_index), 2);
    let refunded_from_users = metric(env, local_user_index, "cycles_refunded_from_deleted_users");
    let refunded_from_pool = metric(env, local_user_index, "cycles_refunded_from_pool_canisters");

    let wasm = wasms::LOCAL_USER_INDEX.clone();
    let args = candid::encode_one(local_user_index_canister::post_upgrade::Args {
        wasm_version: wasm.version,
    })
    .unwrap();
    client::stop_canister(env, canister_ids.user_index, local_user_index);
    env.upgrade_canister(local_user_index, wasm.module.into(), args, Some(canister_ids.user_index))
        .unwrap();
    client::start_canister(env, canister_ids.user_index, local_user_index);
    wait_for_refund_queue_to_empty(env, local_user_index);

    // The canister it controls has been refunded and put back, the other has been dropped untouched
    assert_eq!(canisters_in_pool(env, local_user_index), 1);
    assert!(env.cycle_balance(pool_canister) < MAX_RESIDUAL_CYCLES);
    assert!(env.cycle_balance(uncontrolled_canister) >= 300 * B);

    // Counted as refunded from the pool, leaving the count of deleted users' refunds unchanged
    assert!(metric(env, local_user_index, "cycles_refunded_from_pool_canisters") > refunded_from_pool + 200 * B);
    assert_eq!(
        metric(env, local_user_index, "cycles_refunded_from_deleted_users"),
        refunded_from_users
    );

    // Past the IC's rate limit on installing code, which the refunder's install counts towards
    env.advance_time(Duration::from_secs(10 * 60));
    env.tick();

    // A new user's canister is taken from the pool, then topped up and given the default threshold
    let user = client::register_user(env, canister_ids);
    assert_eq!(user.canister(), pool_canister);
    assert_eq!(canisters_in_pool(env, local_user_index), 0);
    assert!(env.cycle_balance(pool_canister) > 400 * B);
    let status = env.canister_status(pool_canister, Some(local_user_index)).unwrap();
    assert_eq!(status.settings.freezing_threshold, 30u64 * 24 * 60 * 60);

    // Upgrading the LocalUserIndex would affect later tests
    wrapper.discard();
}

fn create_empty_canister(env: &mut PocketIc, local_user_index: CanisterId, controller: Principal) -> CanisterId {
    let subnet_id = env.get_subnet(local_user_index).unwrap();
    let canister_id = env.create_canister_on_subnet(
        Some(controller),
        Some(CanisterSettings {
            controllers: Some(vec![controller]),
            ..Default::default()
        }),
        subnet_id,
    );
    env.add_cycles(canister_id, 300 * B);
    canister_id
}

fn canisters_in_pool(env: &PocketIc, local_user_index: CanisterId) -> u128 {
    metric(env, local_user_index, "canisters_in_pool")
}

fn metric(env: &PocketIc, local_user_index: CanisterId, name: &str) -> u128 {
    metrics(env, local_user_index)[name].as_u64().unwrap().into()
}
