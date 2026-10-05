use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, client};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
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

    let forward_response = client::storage_bucket::forward_file(
        env,
        forwarder,
        file.canister_id,
        &storage_bucket_canister::forward_file::Args {
            file_id: file.blob_id,
            accessors: Vec::new(),
        },
    );
    let storage_bucket_canister::forward_file::Response::Success(forwarded_file_id) = forward_response else {
        panic!("'forward_file' error: {forward_response:?}");
    };
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

fn bytes_used(env: &PocketIc, user_id: Principal, storage_index: CanisterId) -> u64 {
    client::storage_index::happy_path::user(env, user_id, storage_index).bytes_used
}

fn delete_file(env: &mut PocketIc, sender: Principal, bucket: CanisterId, file_id: FileId) {
    let response =
        client::storage_bucket::delete_file(env, sender, bucket, &storage_bucket_canister::delete_file::Args { file_id });
    assert!(matches!(response, storage_bucket_canister::delete_file::Response::Success));
}
