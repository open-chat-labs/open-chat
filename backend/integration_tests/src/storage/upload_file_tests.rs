use crate::env::ENV;
use crate::rng::random_principal;
use crate::{client, TestEnv};
use std::ops::Deref;
use storage_index_canister::add_or_update_users::UserConfig;
use utils::hasher::hash_bytes;

#[test]
fn upload_file() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user_id = random_principal();
    client::storage_index::happy_path::add_or_update_users(
        env,
        canister_ids.user_index,
        canister_ids.storage_index,
        vec![UserConfig {
            user_id,
            byte_limit: 10000,
        }],
    );

    let file = vec![1u8; 1000];
    let file_hash = hash_bytes(&file);
    let file_size = file.len() as u64;

    let allocated_bucket_response =
        client::storage_index::happy_path::allocated_bucket(env, user_id, canister_ids.storage_index, &file);
    let bucket = allocated_bucket_response.canister_id;
    let file_id = allocated_bucket_response.file_id;

    client::storage_bucket::happy_path::upload_file(env, user_id, bucket, file_id, file, None);

    let file_info_response = client::storage_bucket::happy_path::file_info(env, user_id, bucket, file_id);

    assert!(file_info_response.is_owner);
    assert_eq!(file_info_response.file_hash, file_hash);
    assert_eq!(file_info_response.file_size, file_size);

    let user_response = client::storage_index::happy_path::user(env, user_id, canister_ids.storage_index);

    assert_eq!(user_response.bytes_used, file_size);
}
