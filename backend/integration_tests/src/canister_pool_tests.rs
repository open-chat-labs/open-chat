use crate::env::ENV;
use crate::utils::metrics;
use crate::{TestEnv, client};
use constants::B;
use local_user_index_canister::UserIndexEvent;
use pocket_ic::{CanisterSettings, CreateCanisterParams, CreateCanisterPlacement, PocketIc};
use std::ops::Deref;
use types::{CanisterId, SuccessOnly};

// A canister taken from the pool is topped up and given the IC's default freezing threshold as it is
// used, since the pool canisters have had their cycles refunded, which leaves each holding few
// cycles and with a freezing threshold of 0
#[test]
fn pool_canisters_are_topped_up_when_used() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let pool_canister = create_refunded_canister(env, local_user_index);

    // The pool never fills in the tests, so the canister is put into it as the UserIndex once did
    let response = client::local_user_index::c2c_notify_user_index_events(
        env,
        canister_ids.user_index,
        local_user_index,
        &local_user_index_canister::c2c_notify_user_index_events::Args {
            events: vec![UserIndexEvent::AddCanisterToPool(pool_canister)],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));
    assert_eq!(canisters_in_pool(env, local_user_index), 1);

    // A new user's canister is taken from the pool, then topped up and given the default threshold
    let user = client::register_user(env, canister_ids);
    assert_eq!(user.canister(), pool_canister);
    assert_eq!(canisters_in_pool(env, local_user_index), 0);
    assert!(env.cycle_balance(pool_canister) > 400 * B);
    let status = env.canister_status(pool_canister, Some(local_user_index)).unwrap();
    assert_eq!(status.settings.freezing_threshold, 30u64 * 24 * 60 * 60);
}

fn create_refunded_canister(env: &mut PocketIc, local_user_index: CanisterId) -> CanisterId {
    let subnet_id = env.get_subnet(local_user_index).unwrap();
    env.create_canister_with_params(
        Some(local_user_index),
        CreateCanisterParams {
            cycles: Some(100 * B),
            settings: Some(CanisterSettings {
                controllers: Some(vec![local_user_index]),
                freezing_threshold: Some(0u64.into()),
                ..Default::default()
            }),
            placement: Some(CreateCanisterPlacement::SubnetId(subnet_id)),
        },
    )
    .unwrap()
}

fn canisters_in_pool(env: &PocketIc, local_user_index: CanisterId) -> u128 {
    metrics(env, local_user_index)["canisters_in_pool"].as_u64().unwrap().into()
}
