use crate::env::ENV;
use crate::utils::tick_many;
use crate::{client, TestEnv};
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
    }
}
