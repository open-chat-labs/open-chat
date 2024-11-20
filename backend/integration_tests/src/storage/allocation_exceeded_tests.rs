use crate::env::ENV;
use crate::utils::tick_many;
use crate::{client, TestEnv};
use std::ops::Deref;
use std::time::Duration;
use storage_index_canister::add_or_update_users::UserConfig;
use testing::rng::random_principal;

#[test]
fn old_files_deleted_when_allocation_exceeded() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user_id = random_principal();
    client::storage_index::happy_path::add_or_update_users(
        env,
        canister_ids.user_index,
        canister_ids.storage_index,
        vec![UserConfig {
            user_id,
            byte_limit: 1000,
        }],
    );

    let file1 = client::storage_index::happy_path::upload_file(env, user_id, canister_ids.storage_index, 500, Vec::new());

    env.advance_time(Duration::from_millis(1));

    let file2 = client::storage_index::happy_path::upload_file(env, user_id, canister_ids.storage_index, 500, Vec::new());

    tick_many(env, 10);

    assert!(client::storage_bucket::happy_path::file_exists(
        env,
        user_id,
        file1.canister_id,
        file1.blob_id
    ));
    assert!(client::storage_bucket::happy_path::file_exists(
        env,
        user_id,
        file2.canister_id,
        file2.blob_id
    ));

    env.advance_time(Duration::from_millis(1));

    let file3 = client::storage_index::happy_path::upload_file(env, user_id, canister_ids.storage_index, 500, Vec::new());

    tick_many(env, 10);

    assert!(!client::storage_bucket::happy_path::file_exists(
        env,
        user_id,
        file1.canister_id,
        file1.blob_id
    ));
    assert!(client::storage_bucket::happy_path::file_exists(
        env,
        user_id,
        file2.canister_id,
        file2.blob_id
    ));
    assert!(client::storage_bucket::happy_path::file_exists(
        env,
        user_id,
        file3.canister_id,
        file3.blob_id
    ));

    env.advance_time(Duration::from_millis(1));

    let file4 = client::storage_index::happy_path::upload_file(env, user_id, canister_ids.storage_index, 600, Vec::new());

    tick_many(env, 10);

    assert!(!client::storage_bucket::happy_path::file_exists(
        env,
        user_id,
        file1.canister_id,
        file1.blob_id
    ));
    assert!(!client::storage_bucket::happy_path::file_exists(
        env,
        user_id,
        file2.canister_id,
        file2.blob_id
    ));
    assert!(!client::storage_bucket::happy_path::file_exists(
        env,
        user_id,
        file3.canister_id,
        file3.blob_id
    ));
    assert!(client::storage_bucket::happy_path::file_exists(
        env,
        user_id,
        file4.canister_id,
        file4.blob_id
    ));
}
