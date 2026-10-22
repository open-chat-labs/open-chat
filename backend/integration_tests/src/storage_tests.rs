use crate::env::ENV;
use crate::utils::{metrics, tick_many};
use crate::{TestEnv, client};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use storage_index_canister::add_or_update_users::UserConfig;
use types::BlobReference;

#[test]
fn oldest_files_deleted_once_limit_exceeded() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);

    env.tick();

    assert!(client::storage_index::happy_path::user(env, user.principal, canister_ids.storage_index).byte_limit > 0);

    client::storage_index::add_or_update_users(
        env,
        canister_ids.user_index,
        canister_ids.storage_index,
        &storage_index_canister::add_or_update_users::Args {
            users: vec![UserConfig {
                user_id: user.principal,
                byte_limit: 1000,
            }],
        },
    );

    let mut files = Vec::new();
    for _ in 0..5 {
        files.push(client::storage_index::happy_path::upload_file(
            env,
            user.principal,
            canister_ids.storage_index,
            500,
            Vec::new(),
        ));
        env.advance_time(Duration::from_secs(1));
        tick_many(env, 5);

        for (index, BlobReference { canister_id, blob_id }) in files.iter().rev().enumerate() {
            let exists = client::storage_bucket::happy_path::file_exists(env, user.principal, *canister_id, *blob_id);
            assert_eq!(exists, index < 2);
        }

        // The files deleted to make room no longer count towards the limit
        let bytes_used = client::storage_index::happy_path::user(env, user.principal, canister_ids.storage_index).bytes_used;
        assert_eq!(bytes_used, 500 * files.len().min(2) as u64);
    }
}

#[test]
fn add_bucket_canister_fails_for_an_unknown_subnet() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let active_buckets = |env: &PocketIc| {
        metrics(env, canister_ids.storage_index)["active_buckets"]
            .as_array()
            .unwrap()
            .len()
    };
    let before = active_buckets(env);

    // The CMC refuses to create a canister on a subnet it doesn't know and refunds the cycles, which
    // the StorageIndex reports as an error
    let response = client::storage_index::add_bucket_canister(
        env,
        *controller,
        canister_ids.storage_index,
        &storage_index_canister::add_bucket_canister::Args {
            subnet_id: Some(Principal::from_slice(&[7; 29])),
        },
    );

    assert!(
        matches!(response, storage_index_canister::add_bucket_canister::Response::Error(_)),
        "{response:?}"
    );
    assert_eq!(active_buckets(env), before);
}
