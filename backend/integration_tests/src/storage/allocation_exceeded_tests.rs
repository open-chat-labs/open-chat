use crate::env::ENV;
use crate::rng::random_principal;
use crate::utils::tick_many;
use crate::{client, TestEnv};
use std::ops::Deref;
use std::time::Duration;
use storage_index_canister::add_or_update_users::UserConfig;

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

    let file1 = vec![1u8; 500];
    let file2 = vec![2u8; 500];
    let file3 = vec![3u8; 500];
    let file4 = vec![4u8; 600];

    let allocated_bucket_response1 =
        client::storage_index::happy_path::allocated_bucket(env, user_id, canister_ids.storage_index, &file1);
    let bucket1 = allocated_bucket_response1.canister_id;
    let file_id1 = allocated_bucket_response1.file_id;
    client::storage_bucket::happy_path::upload_file(env, user_id, bucket1, file_id1, file1, None);

    env.advance_time(Duration::from_millis(1));

    let allocated_bucket_response2 =
        client::storage_index::happy_path::allocated_bucket(env, user_id, canister_ids.storage_index, &file2);
    let bucket2 = allocated_bucket_response2.canister_id;
    let file_id2 = allocated_bucket_response2.file_id;
    client::storage_bucket::happy_path::upload_file(env, user_id, bucket2, file_id2, file2, None);

    tick_many(env, 10);

    assert!(client::storage_bucket::happy_path::file_exists(
        &env, user_id, bucket1, file_id1
    ));
    assert!(client::storage_bucket::happy_path::file_exists(
        &env, user_id, bucket2, file_id2
    ));

    env.advance_time(Duration::from_millis(1));

    let allocated_bucket_response3 =
        client::storage_index::happy_path::allocated_bucket(env, user_id, canister_ids.storage_index, &file3);
    let bucket3 = allocated_bucket_response3.canister_id;
    let file_id3 = allocated_bucket_response3.file_id;
    client::storage_bucket::happy_path::upload_file(env, user_id, bucket3, file_id3, file3, None);

    tick_many(env, 10);

    assert!(!client::storage_bucket::happy_path::file_exists(
        &env, user_id, bucket1, file_id1
    ));
    assert!(client::storage_bucket::happy_path::file_exists(
        &env, user_id, bucket2, file_id2
    ));
    assert!(client::storage_bucket::happy_path::file_exists(
        &env, user_id, bucket3, file_id3
    ));

    env.advance_time(Duration::from_millis(1));

    let allocated_bucket_response4 =
        client::storage_index::happy_path::allocated_bucket(env, user_id, canister_ids.storage_index, &file4);
    let bucket4 = allocated_bucket_response4.canister_id;
    let file_id4 = allocated_bucket_response4.file_id;
    client::storage_bucket::happy_path::upload_file(env, user_id, bucket4, file_id4, file4, None);

    tick_many(env, 10);

    assert!(!client::storage_bucket::happy_path::file_exists(
        &env, user_id, bucket1, file_id1
    ));
    assert!(!client::storage_bucket::happy_path::file_exists(
        &env, user_id, bucket2, file_id2
    ));
    assert!(!client::storage_bucket::happy_path::file_exists(
        &env, user_id, bucket3, file_id3
    ));
    assert!(client::storage_bucket::happy_path::file_exists(
        &env, user_id, bucket4, file_id4
    ));
}
