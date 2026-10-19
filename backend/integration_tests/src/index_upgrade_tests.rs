use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::utils::{metrics, now_millis, tick_many};
use crate::{TestEnv, client, wasms};
use candid::Principal;
use pocket_ic::PocketIc;
use rand::random;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_internet_identity_principal, random_string};
use types::{CanisterId, CanisterWasm, Empty};

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

// Events the UserIndex in production has queued for a LocalUserIndex and for the Identity canister,
// which it couldn't send because they were stopped, are sent once the UserIndex has been upgraded.
// Its queues' fields and types change between releases, so this checks the post_upgrade one-off
// carries what the production wasm left in them across.
#[test]
fn events_queued_by_the_prod_user_index_are_sent_after_the_upgrade() {
    // A new env, since upgrading the UserIndex in one shared with other tests can disrupt them
    let mut wrapper = ENV.deref().create_new();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    // The OpenChat installer controls the UserIndex and the Identity canister, and the UserIndex
    // controls the LocalUserIndexes
    let installer = canister_ids.openchat_installer;
    upgrade_user_index(env, installer, canister_ids.user_index, wasms::USER_INDEX_PROD.clone());

    // The user's identity is created while the Identity canister is running, and the user registered
    // once it has stopped, so the UserIndex queues the user's id for it
    let (auth_principal, public_key) = random_internet_identity_principal();
    let identity = client::identity::happy_path::create_identity(
        env,
        auth_principal,
        canister_ids.identity,
        public_key,
        random::<[u8; 32]>().to_vec(),
        true,
    );
    stop_canister(env, installer, canister_ids.identity);

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let user = client::local_user_index::happy_path::register_user_with_referrer(
        env,
        Principal::self_authenticating(&identity.user_key),
        local_user_index,
        identity.user_key,
        None,
        None,
    );
    tick_many(env, 3);

    // A username change made while the user's LocalUserIndex is stopped is queued for it
    stop_canister(env, canister_ids.user_index, local_user_index);
    env.advance_time(Duration::from_millis(1));
    let since = now_millis(env);
    let username = random_string();
    client::user_index::happy_path::set_username(env, user.principal, canister_ids.user_index, username.clone());
    tick_many(env, 3);

    let queued_for_local_user_index = metrics(env, canister_ids.user_index)["user_index_events_queue_length"]
        .as_u64()
        .unwrap();
    assert!(queued_for_local_user_index > 0);

    upgrade_user_index(env, installer, canister_ids.user_index, wasms::USER_INDEX.clone());
    start_canister(env, canister_ids.user_index, local_user_index);
    start_canister(env, installer, canister_ids.identity);

    let mut identity_synced = false;
    let mut username_synced = false;
    for _ in 0..30 {
        identity_synced = identity_synced
            || matches!(
                client::identity::check_auth_principal_v2(env, auth_principal, canister_ids.identity, &Empty {}),
                identity_canister::check_auth_principal_v2::Response::Success(r) if r.user_id == Some(user.user_id)
            );
        username_synced = username_synced
            || client::user::happy_path::updates(env, &user, since).is_some_and(|u| u.username.as_ref() == Some(&username));
        if identity_synced && username_synced {
            break;
        }
        env.advance_time(Duration::from_secs(10));
        env.tick();
    }
    assert!(identity_synced, "The Identity canister wasn't told of the user's id");
    assert!(username_synced, "The user's canister wasn't told of the new username");

    wrapper.discard();
}

fn upgrade_user_index(env: &mut PocketIc, controller: Principal, user_index: CanisterId, wasm: CanisterWasm) {
    let args = candid::encode_one(user_index_canister::post_upgrade::Args {
        wasm_version: wasm.version,
    })
    .unwrap();
    stop_canister(env, controller, user_index);
    env.upgrade_canister(user_index, wasm.module.into(), args, Some(controller))
        .unwrap();
    start_canister(env, controller, user_index);
}
