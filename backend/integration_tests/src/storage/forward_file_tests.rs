use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, client};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use storage_index_canister::add_or_update_users::UserConfig;
use testing::rng::random_principal;
use types::{CanisterId, FileId};

#[test]
fn a_forwarded_file_counts_towards_the_forwarders_allowance_until_they_delete_it() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let owner = random_principal();
    let forwarder = random_principal();
    client::storage_index::happy_path::add_or_update_users(
        env,
        canister_ids.user_index,
        canister_ids.storage_index,
        [owner, forwarder]
            .into_iter()
            .map(|user_id| UserConfig {
                user_id,
                byte_limit: 10_000,
            })
            .collect(),
    );

    let file = client::storage_index::happy_path::upload_file(env, owner, canister_ids.storage_index, 500, Vec::new());
    tick_many(env, 10);

    let forwarded_file_id = forward_file(env, forwarder, file.canister_id, file.blob_id);
    tick_many(env, 10);

    assert_eq!(bytes_used(env, owner, canister_ids.storage_index), 500);
    assert_eq!(bytes_used(env, forwarder, canister_ids.storage_index), 500);

    delete_file(env, forwarder, file.canister_id, forwarded_file_id);
    tick_many(env, 10);

    assert_eq!(bytes_used(env, owner, canister_ids.storage_index), 500);
    assert_eq!(bytes_used(env, forwarder, canister_ids.storage_index), 0);

    delete_file(env, owner, file.canister_id, file.blob_id);
    tick_many(env, 10);

    assert_eq!(bytes_used(env, owner, canister_ids.storage_index), 0);
}

#[test]
fn forwarding_a_file_over_the_forwarders_allowance_evicts_their_own_oldest_files() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let owner = random_principal();
    let forwarder = random_principal();
    client::storage_index::happy_path::add_or_update_users(
        env,
        canister_ids.user_index,
        canister_ids.storage_index,
        vec![
            UserConfig {
                user_id: owner,
                byte_limit: 10_000,
            },
            UserConfig {
                user_id: forwarder,
                byte_limit: 1000,
            },
        ],
    );

    let forwarders_file =
        client::storage_index::happy_path::upload_file(env, forwarder, canister_ids.storage_index, 600, Vec::new());
    env.advance_time(Duration::from_millis(1));
    let file = client::storage_index::happy_path::upload_file(env, owner, canister_ids.storage_index, 500, Vec::new());
    tick_many(env, 10);

    let forwarded_file_id = forward_file(env, forwarder, file.canister_id, file.blob_id);
    tick_many(env, 10);

    assert!(!client::storage_bucket::happy_path::file_exists(
        env,
        forwarder,
        forwarders_file.canister_id,
        forwarders_file.blob_id
    ));
    assert!(client::storage_bucket::happy_path::file_exists(
        env,
        forwarder,
        file.canister_id,
        forwarded_file_id
    ));
    assert!(client::storage_bucket::happy_path::file_exists(
        env,
        owner,
        file.canister_id,
        file.blob_id
    ));
    assert_eq!(bytes_used(env, owner, canister_ids.storage_index), 500);
    assert_eq!(bytes_used(env, forwarder, canister_ids.storage_index), 500);
}

fn forward_file(env: &mut PocketIc, sender: Principal, bucket: CanisterId, file_id: FileId) -> FileId {
    let response = client::storage_bucket::forward_file(
        env,
        sender,
        bucket,
        &storage_bucket_canister::forward_file::Args {
            file_id,
            accessors: Vec::new(),
        },
    );
    let storage_bucket_canister::forward_file::Response::Success(forwarded_file_id) = response else {
        panic!("'forward_file' error: {response:?}");
    };
    forwarded_file_id
}

fn bytes_used(env: &PocketIc, user_id: Principal, storage_index: CanisterId) -> u64 {
    client::storage_index::happy_path::user(env, user_id, storage_index).bytes_used
}

fn delete_file(env: &mut PocketIc, sender: Principal, bucket: CanisterId, file_id: FileId) {
    let response =
        client::storage_bucket::delete_file(env, sender, bucket, &storage_bucket_canister::delete_file::Args { file_id });
    assert!(matches!(response, storage_bucket_canister::delete_file::Response::Success));
}
