use crate::env::ENV;
use crate::utils::{metrics, try_metrics};
use crate::{CanisterIds, TestEnv, client};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use types::{CanisterId, UnitResult};

// A platform operator sets the key on the UserIndex, which fans it out to every LocalUserIndex, each
// of which passes it on to its MultiUser canisters, including any created afterwards
#[test]
fn alchemy_api_key_reaches_every_multi_user_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        platform_operator,
        ..
    } = wrapper.env();

    // So that there's at least one MultiUser canister to pass the key on to
    client::register_user(env, canister_ids);

    set_alchemy_api_key(env, *platform_operator, canister_ids.user_index, Some("key"));
    wait_for_key_everywhere(env, canister_ids, true);

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *platform_operator, canister_ids, local_user_index);
    assert_eq!(alchemy_api_key_set(env, canister_id), Some(true));

    // Test envs are pooled, so the key is unset again, which is passed on in the same way
    set_alchemy_api_key(env, *platform_operator, canister_ids.user_index, None);
    wait_for_key_everywhere(env, canister_ids, false);
}

fn set_alchemy_api_key(env: &mut PocketIc, platform_operator: Principal, user_index: CanisterId, api_key: Option<&str>) {
    let response = client::user_index::set_alchemy_api_key(
        env,
        platform_operator,
        user_index,
        &user_index_canister::set_alchemy_api_key::Args {
            api_key: api_key.map(|k| k.to_string()),
        },
    );
    assert!(matches!(response, UnitResult::Success));
}

// Ticks until the UserIndex, every LocalUserIndex and every MultiUser canister report the key as set
// (or not), since it is passed on over the UserIndex's event queue and then by c2c calls
fn wait_for_key_everywhere(env: &mut PocketIc, canister_ids: &CanisterIds, set: bool) {
    let mut canisters = vec![canister_ids.user_index];
    canisters.extend(canister_ids.subnets.iter().map(|s| s.local_user_index));
    canisters.extend(multi_user_canisters(env, canister_ids.user_index));

    for _ in 0..50 {
        if canisters.iter().all(|c| alchemy_api_key_set(env, *c) == Some(set)) {
            return;
        }
        env.tick();
    }

    let lagging: Vec<_> = canisters
        .into_iter()
        .filter(|c| alchemy_api_key_set(env, *c) != Some(set))
        .collect();
    panic!("Canisters not reporting alchemy_api_key_set = {set}: {lagging:?}");
}

fn alchemy_api_key_set(env: &PocketIc, canister_id: CanisterId) -> Option<bool> {
    try_metrics(env, canister_id)?["alchemy_api_key_set"].as_bool()
}

fn multi_user_canisters(env: &PocketIc, user_index: CanisterId) -> Vec<CanisterId> {
    metrics(env, user_index)["multi_user_canisters"]
        .as_array()
        .unwrap()
        .iter()
        .map(|entry| Principal::from_text(entry[0].as_str().unwrap()).unwrap())
        .collect()
}
