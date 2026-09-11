use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, client, wasms};
use candid::Principal;
use pocket_ic::PocketIc;
use sha256::sha256;
use std::collections::BTreeMap;
use std::ops::Deref;
use types::{BuildVersion, CanisterId, CanisterWasm, HttpRequest, UpgradesFilter};

#[test]
fn create_then_upgrade_multi_user_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);

    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let status = env.canister_status(canister_id, Some(local_user_index)).unwrap();
    assert_eq!(status.module_hash, Some(sha256(&wasms::MULTI_USER.module).to_vec()));
    assert_eq!(wasm_version(env, canister_id), BuildVersion::min());
    assert_stable_memory_maps_initialised(env, canister_id);

    // The canister id -> LocalUserIndex mapping reaches the UserIndex over the idempotent event
    // queue rather than in the reply, so it takes a few rounds to arrive
    tick_many(env, 5);
    assert!(
        multi_user_canisters(env, canister_ids.user_index).contains(&(canister_id, local_user_index)),
        "MultiUser canister not registered against its LocalUserIndex"
    );

    let new_version = BuildVersion::new(0, 0, 1);
    client::user_index::happy_path::upgrade_multi_user_canister_wasm(
        env,
        *controller,
        canister_ids.user_index,
        CanisterWasm {
            version: new_version,
            module: wasms::MULTI_USER.module.clone(),
        },
    );
    // The rolling upgrade stops, upgrades then restarts the canister across several rounds
    tick_many(env, 20);

    assert_eq!(wasm_version(env, canister_id), new_version);
    assert_stable_memory_maps_initialised(env, canister_id);
}

#[test]
fn upgrade_filter_naming_unknown_canister_is_rejected() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    // An `include` filter naming a canister the UserIndex has no mapping for must be rejected. If
    // it were dropped the upgrade would report success having pushed the wasm to nobody
    let response = client::user_index::happy_path::upgrade_multi_user_canister_wasm_with_filter(
        env,
        *controller,
        canister_ids.user_index,
        CanisterWasm {
            version: BuildVersion::new(0, 0, 2),
            module: wasms::MULTI_USER.module.clone(),
        },
        Some(UpgradesFilter {
            include: [Principal::from_slice(&[1, 2, 3])].into_iter().collect(),
            ..Default::default()
        }),
    );

    assert!(
        matches!(
            response,
            user_index_canister::upgrade_multi_user_canister_wasm::Response::InternalError(_)
        ),
        "{response:?}"
    );
}

#[test]
fn multi_user_canisters_enabled_flag_fans_out_to_local_user_indexes() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);

    assert!(!multi_user_canisters_enabled(env, canister_ids.user_index));
    assert!(!multi_user_canisters_enabled(env, local_user_index));

    client::user_index::happy_path::set_multi_user_canisters_enabled(env, *controller, canister_ids.user_index, true);

    // The UserIndex records it immediately, the LocalUserIndex receives it over the event queue
    assert!(multi_user_canisters_enabled(env, canister_ids.user_index));
    tick_many(env, 5);
    assert!(multi_user_canisters_enabled(env, local_user_index));

    client::user_index::happy_path::set_multi_user_canisters_enabled(env, *controller, canister_ids.user_index, false);
    tick_many(env, 5);

    assert!(!multi_user_canisters_enabled(env, canister_ids.user_index));
    assert!(!multi_user_canisters_enabled(env, local_user_index));
}

fn multi_user_canisters_enabled(env: &PocketIc, canister_id: CanisterId) -> bool {
    serde_json::from_value(metrics(env, canister_id)["multi_user_canisters_enabled"].clone()).unwrap()
}

// Creating a map writes its header, so each map's memory is non-empty once it has been initialised
fn assert_stable_memory_maps_initialised(env: &PocketIc, canister_id: CanisterId) {
    let stable_memory_sizes: BTreeMap<u8, u64> =
        serde_json::from_value(metrics(env, canister_id)["stable_memory_sizes"].clone()).unwrap();

    for memory_id in [1, 2] {
        assert!(
            stable_memory_sizes.get(&memory_id).is_some_and(|size| *size > 0),
            "Stable memory map {memory_id} not initialised: {stable_memory_sizes:?}"
        );
    }
}

fn wasm_version(env: &PocketIc, canister_id: CanisterId) -> BuildVersion {
    serde_json::from_value(metrics(env, canister_id)["wasm_version"].clone()).unwrap()
}

fn multi_user_canisters(env: &PocketIc, user_index_canister_id: CanisterId) -> Vec<(CanisterId, CanisterId)> {
    serde_json::from_value(metrics(env, user_index_canister_id)["multi_user_canisters"].clone()).unwrap()
}

fn metrics(env: &PocketIc, canister_id: CanisterId) -> serde_json::Value {
    let response = client::http_request(
        env,
        Principal::anonymous(),
        canister_id,
        &HttpRequest {
            method: "GET".to_string(),
            url: "/metrics".to_string(),
            headers: Vec::new(),
            body: Vec::new(),
        },
    );
    assert_eq!(response.status_code, 200);

    serde_json::from_slice(&response.body).unwrap()
}
