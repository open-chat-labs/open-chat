use crate::env::ENV;
use crate::rng::random_principal;
use crate::utils::{now_millis, tick_many};
use crate::{client, TestEnv};
use std::ops::Deref;
use std::time::Duration;
use storage_index_canister::add_or_update_users::UserConfig;

#[test]
fn file_is_removed_after_expiry_date() {
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

    let allocated_bucket_response =
        client::storage_index::happy_path::allocated_bucket(env, user_id, canister_ids.storage_index, &file);
    let bucket = allocated_bucket_response.canister_id;
    let file_id = allocated_bucket_response.file_id;

    let now = now_millis(&env);

    client::storage_bucket::happy_path::upload_file(env, user_id, bucket, file_id, file, Some(now + 1000));

    env.advance_time(Duration::from_millis(999));
    env.tick();

    let file_info_response1 =
        client::storage_bucket::file_info(env, user_id, bucket, &storage_bucket_canister::file_info::Args { file_id });
    assert!(matches!(
        file_info_response1,
        storage_bucket_canister::file_info::Response::Success(_)
    ));

    env.advance_time(Duration::from_millis(1));
    tick_many(env, 5);

    let file_info_response2 =
        client::storage_bucket::file_info(env, user_id, bucket, &storage_bucket_canister::file_info::Args { file_id });
    assert!(matches!(
        file_info_response2,
        storage_bucket_canister::file_info::Response::NotFound
    ));

    let user_response = client::storage_index::happy_path::user(env, user_id, canister_ids.storage_index);

    assert_eq!(user_response.bytes_used, 0);
}
