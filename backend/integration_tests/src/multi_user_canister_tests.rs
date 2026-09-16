use crate::env::ENV;
use crate::utils::{metrics, tick_many};
use crate::{TestEnv, client, wasms};
use candid::Principal;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use sha256::sha256;
use std::collections::BTreeMap;
use std::ops::Deref;
use testing::rng::{random_principal, random_string};
use types::{BuildVersion, CanisterId, CanisterWasm, UpgradesFilter, UserId};

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
fn users_created_in_multi_user_canister_are_addressed_by_indexed_user_id() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let canister_id =
        client::user_index::happy_path::create_multi_user_canister(env, *controller, canister_ids.user_index, local_user_index);

    let create_user = |env: &mut PocketIc, principal: Principal| {
        client::multi_user::c2c_create_user(
            env,
            local_user_index,
            canister_id,
            &multi_user_canister::c2c_create_user::Args {
                principal,
                username: random_string(),
                referred_by: None,
            },
        )
    };
    let bio = |env: &PocketIc, user_id: UserId| {
        env.query_call(
            canister_id,
            Principal::anonymous(),
            "bio_msgpack",
            msgpack::serialize_then_unwrap(user_canister::bio::Args { user_id }),
        )
        .map(|bytes| msgpack::deserialize_then_unwrap::<user_canister::bio::Response>(&bytes))
    };

    // Each user's id carries this canister's id plus their index, starting from 1
    let principals = [random_principal(), random_principal()];
    let user_ids: Vec<UserId> = principals
        .iter()
        .map(|principal| match create_user(env, *principal) {
            multi_user_canister::c2c_create_user::Response::Success(user_id) => user_id,
            response => panic!("{response:?}"),
        })
        .collect();
    for (i, user_id) in user_ids.iter().enumerate() {
        assert_eq!(user_id.canister_id(), canister_id);
        assert_eq!(user_id.index() as usize, i + 1);
        assert!(matches!(bio(env, *user_id), Ok(user_canister::bio::Response::Success(text)) if text.is_empty()));
    }
    assert_eq!(user_count(env, canister_id), 2);

    // A principal can only be registered once
    let duplicate = create_user(env, principals[0]);
    assert!(
        matches!(&duplicate, multi_user_canister::c2c_create_user::Response::Error(e) if e.matches_code(OCErrorCode::AlreadyRegistered)),
        "{duplicate:?}"
    );
    assert_eq!(user_count(env, canister_id), 2);

    // An index this canister has not assigned, another canister's user, or an id which carries no
    // index (so maps to index 0) is rejected
    assert!(bio(env, UserId::new_indexed(canister_id, 3)).is_err());
    assert!(bio(env, UserId::new_indexed(canister_ids.user_index, 1)).is_err());
    assert!(bio(env, canister_id.into()).is_err());

    // The users survive an upgrade
    client::user_index::happy_path::upgrade_multi_user_canister_wasm(
        env,
        *controller,
        canister_ids.user_index,
        CanisterWasm {
            version: BuildVersion::new(0, 0, 1),
            module: wasms::MULTI_USER.module.clone(),
        },
    );
    tick_many(env, 20);
    assert_eq!(wasm_version(env, canister_id), BuildVersion::new(0, 0, 1));
    assert_eq!(user_count(env, canister_id), 2);
    assert!(matches!(bio(env, user_ids[1]), Ok(user_canister::bio::Response::Success(_))));
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

fn user_count(env: &PocketIc, canister_id: CanisterId) -> u32 {
    serde_json::from_value(metrics(env, canister_id)["user_count"].clone()).unwrap()
}

fn wasm_version(env: &PocketIc, canister_id: CanisterId) -> BuildVersion {
    serde_json::from_value(metrics(env, canister_id)["wasm_version"].clone()).unwrap()
}

fn multi_user_canisters(env: &PocketIc, user_index_canister_id: CanisterId) -> Vec<(CanisterId, CanisterId)> {
    serde_json::from_value(metrics(env, user_index_canister_id)["multi_user_canisters"].clone()).unwrap()
}
