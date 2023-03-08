use crate::client;
use crate::rng::random_principal;
use crate::setup::{return_env, setup_env, TestEnv};
use crate::utils::{now_millis, tick_many};
use std::time::Duration;
use storage_index_canister::add_or_update_users::UserConfig;

#[test]
fn file_is_removed_after_expiry_date() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let user_id = random_principal();
    client::storage_index::happy_path::add_or_update_users(
        &mut env,
        canister_ids.user_index,
        canister_ids.storage_index,
        vec![UserConfig {
            user_id,
            byte_limit: 10000,
        }],
    );

    let file = vec![1u8; 1000];

    let allocated_bucket_response =
        client::storage_index::happy_path::allocated_bucket(&env, user_id, canister_ids.storage_index, &file);
    let bucket = allocated_bucket_response.canister_id;
    let file_id = allocated_bucket_response.file_id;

    let now = now_millis(&env);

    client::storage_bucket::happy_path::upload_file(&mut env, user_id, bucket, file_id, file, Some(now + 1000));

    env.advance_time(Duration::from_millis(999));
    env.tick();

    let file_info_response1 =
        client::storage_bucket::file_info(&env, user_id, bucket, &storage_bucket_canister::file_info::Args { file_id });
    assert!(matches!(
        file_info_response1,
        storage_bucket_canister::file_info::Response::Success(_)
    ));

    env.advance_time(Duration::from_millis(1));
    tick_many(&mut env, 5);

    let file_info_response2 =
        client::storage_bucket::file_info(&env, user_id, bucket, &storage_bucket_canister::file_info::Args { file_id });
    assert!(matches!(
        file_info_response2,
        storage_bucket_canister::file_info::Response::NotFound
    ));

    let user_response = client::storage_index::happy_path::user(&env, user_id, canister_ids.storage_index);

    assert_eq!(user_response.bytes_used, 0);

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}
