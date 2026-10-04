use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, client};
use std::ops::Deref;
use storage_index_canister::add_or_update_users::UserConfig;
use testing::rng::random_principal;
use types::SuccessOnly;

#[test]
fn removing_an_accessor_removes_its_files_and_frees_their_allowance() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user_id = random_principal();
    let accessor = random_principal();
    client::storage_index::happy_path::add_or_update_users(
        env,
        canister_ids.user_index,
        canister_ids.storage_index,
        vec![UserConfig {
            user_id,
            byte_limit: 1000,
        }],
    );

    let file = client::storage_index::happy_path::upload_file(env, user_id, canister_ids.storage_index, 500, vec![accessor]);

    tick_many(env, 10);

    let bytes_used = client::storage_index::happy_path::user(env, user_id, canister_ids.storage_index).bytes_used;
    assert_eq!(bytes_used, 500);

    let response = client::storage_index::remove_accessors(
        env,
        canister_ids.user_index,
        canister_ids.storage_index,
        &storage_index_canister::remove_accessors::Args {
            accessor_ids: vec![accessor],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));

    tick_many(env, 10);

    assert!(!client::storage_bucket::happy_path::file_exists(
        env,
        user_id,
        file.canister_id,
        file.blob_id
    ));
    let bytes_used = client::storage_index::happy_path::user(env, user_id, canister_ids.storage_index).bytes_used;
    assert_eq!(bytes_used, 0);
}
