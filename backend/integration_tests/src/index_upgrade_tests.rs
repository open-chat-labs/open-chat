use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, client, wasms};
use std::ops::Deref;
use testing::rng::random_string;

// The UserIndex and GroupIndex can be upgraded onto their own wasms, and carry on working afterwards.
// A call made during an upgrade fails it, so a one-off which calls another canister must do so from a
// timer, which this catches.
#[test]
fn the_user_index_and_group_index_can_be_upgraded() {
    // A new env, since upgrading the UserIndex in one shared with other tests can disrupt them
    let mut wrapper = ENV.deref().create_new();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let group_name = random_string();
    let group_id = client::user::happy_path::create_group(env, &user, &group_name, true, true);
    tick_many(env, 3);

    // The OpenChat installer controls both
    let installer = canister_ids.openchat_installer;

    let user_index_wasm = wasms::USER_INDEX.clone();
    let args = candid::encode_one(user_index_canister::post_upgrade::Args {
        wasm_version: user_index_wasm.version,
    })
    .unwrap();
    stop_canister(env, installer, canister_ids.user_index);
    env.upgrade_canister(canister_ids.user_index, user_index_wasm.module.into(), args, Some(installer))
        .unwrap();
    start_canister(env, installer, canister_ids.user_index);

    let group_index_wasm = wasms::GROUP_INDEX.clone();
    let args = candid::encode_one(group_index_canister::post_upgrade::Args {
        wasm_version: group_index_wasm.version,
    })
    .unwrap();
    stop_canister(env, installer, canister_ids.group_index);
    env.upgrade_canister(
        canister_ids.group_index,
        group_index_wasm.module.into(),
        args,
        Some(installer),
    )
    .unwrap();
    start_canister(env, installer, canister_ids.group_index);

    tick_many(env, 10);

    assert_eq!(
        client::user_index::happy_path::user(env, canister_ids.user_index, user.user_id).user_id,
        user.user_id
    );
    let matches = client::group_index::happy_path::explore_groups(env, user.principal, canister_ids.group_index, &group_name);
    assert!(matches.iter().any(|m| m.id == group_id));

    wrapper.discard();
}
