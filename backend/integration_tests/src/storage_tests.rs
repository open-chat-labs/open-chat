use crate::env::ENV;
use crate::utils::tick_many;
use crate::{client, TestEnv};
use candid::Principal;
use pocket_ic::PocketIc;
use rand::{thread_rng, RngCore};
use std::ops::Deref;
use std::time::Duration;
use storage_index_canister::add_or_update_users::UserConfig;
use types::{CanisterId, FileId};

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
        files.push(upload_file(env, user.principal, canister_ids.storage_index, 500));
        env.advance_time(Duration::from_secs(1));
        tick_many(env, 5);

        for (index, (bucket, file_id)) in files.iter().rev().enumerate() {
            let exists = client::storage_bucket::happy_path::file_exists(env, user.principal, *bucket, *file_id);
            assert_eq!(exists, index < 2);
        }
    }
}

fn upload_file(env: &mut PocketIc, sender: Principal, index_canister_id: CanisterId, file_size: usize) -> (CanisterId, FileId) {
    let mut file = vec![0; file_size];
    thread_rng().fill_bytes(file.as_mut_slice());

    let bucket_response = client::storage_index::happy_path::allocated_bucket(env, sender, index_canister_id, &file);

    client::storage_bucket::happy_path::upload_file(
        env,
        sender,
        bucket_response.canister_id,
        bucket_response.file_id,
        file,
        None,
    );

    (bucket_response.canister_id, bucket_response.file_id)
}
