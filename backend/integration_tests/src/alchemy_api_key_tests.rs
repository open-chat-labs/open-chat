use crate::env::ENV;
use crate::utils::{metrics, tick_many, try_metrics};
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use pocket_ic::common::rest::CanisterHttpRequest;
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
    let user = client::register_user(env, canister_ids);

    // Anyone other than a platform operator is refused
    let args = msgpack::serialize_then_unwrap(user_index_canister::set_alchemy_api_key::Args {
        api_key: Some("key".to_string()),
    });
    let response = env.update_call(canister_ids.user_index, user.principal, "set_alchemy_api_key_msgpack", args);
    assert!(response.is_err());

    set_alchemy_api_key(env, *platform_operator, canister_ids.user_index, Some("key"));
    wait_for_key_everywhere(env, canister_ids, &[], true);

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *platform_operator, canister_ids, local_user_index);
    assert_eq!(alchemy_api_key_set(env, canister_id), Some(true));

    // Test envs are pooled, so the key is unset again, which is passed on in the same way. The new
    // canister is named explicitly, since the UserIndex may not yet have been told of it.
    set_alchemy_api_key(env, *platform_operator, canister_ids.user_index, None);
    wait_for_key_everywhere(env, canister_ids, &[canister_id], false);
}

// A user without a SOL address can't have deposited anything, so `update_sol_balance` turns them away
// without asking the minter, nor, once the key is set, Alchemy. The test env has no ckSOL minter, so
// no address can be generated, and the path with one can't be tested here.
#[test]
fn update_sol_balance_turns_away_a_user_without_an_address() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        platform_operator,
        ..
    } = wrapper.env();

    let user = client::register_user(env, canister_ids);

    let response = update_sol_balance(env, &user);
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::NoChange)),
        "{response:?}"
    );

    set_alchemy_api_key(env, *platform_operator, canister_ids.user_index, Some("key"));
    wait_for_key_everywhere(env, canister_ids, &[user.canister()], true);

    let response = update_sol_balance(env, &user);
    assert!(
        matches!(&response, UnitResult::Error(e) if e.matches_code(OCErrorCode::NoChange)),
        "{response:?}"
    );

    // Test envs are pooled, so the key is unset again
    set_alchemy_api_key(env, *platform_operator, canister_ids.user_index, None);
    wait_for_key_everywhere(env, canister_ids, &[user.canister()], false);
}

// Fails if the call makes an outcall to Alchemy, rather than leaving it pending, which would leave
// the call waiting forever
fn update_sol_balance(env: &mut PocketIc, user: &User) -> UnitResult {
    let message_id = env
        .submit_call(
            user.canister(),
            user.principal,
            "update_sol_balance_msgpack",
            msgpack::serialize_then_unwrap(multi_user_canister::update_sol_balance::Args { user_id: user.user_id }),
        )
        .unwrap();
    tick_many(env, 5);
    let outcalls: Vec<CanisterHttpRequest> = env
        .get_canister_http()
        .into_iter()
        .filter(|request| request.url.contains("alchemy.com"))
        .collect();
    assert!(outcalls.is_empty(), "Unexpected outcalls to Alchemy: {outcalls:?}");
    msgpack::deserialize_then_unwrap(&env.await_call(message_id).unwrap())
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
// (or not), since it is passed on over the UserIndex's and then each LocalUserIndex's event queues
fn wait_for_key_everywhere(env: &mut PocketIc, canister_ids: &CanisterIds, also: &[CanisterId], set: bool) {
    let mut canisters = vec![canister_ids.user_index];
    canisters.extend(canister_ids.subnets.iter().map(|s| s.local_user_index));
    canisters.extend(multi_user_canisters(env, canister_ids.user_index));
    canisters.extend(also.iter().filter(|c| !canisters.contains(c)).copied().collect::<Vec<_>>());

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
