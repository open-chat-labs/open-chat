use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, client, wasms};
use candid::Principal;
use pocket_ic::PocketIc;
use sha256::sha256;
use std::ops::Deref;
use types::{BuildVersion, CanisterId, CanisterWasm, HttpRequest};

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
}

fn wasm_version(env: &PocketIc, canister_id: CanisterId) -> BuildVersion {
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

    let metrics: serde_json::Value = serde_json::from_slice(&response.body).unwrap();
    serde_json::from_value(metrics["wasm_version"].clone()).unwrap()
}
