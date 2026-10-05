use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, client};
use candid::Principal;
use constants::DAY_IN_MS;
use pocket_ic::PocketIc;
use rand::Rng;
use std::ops::Deref;
use std::time::Duration;
use storage_index_canister::add_or_update_users::UserConfig;
use testing::rng::random_principal;
use types::CanisterId;
use utils::hasher::hash_bytes;

#[test]
fn an_abandoned_upload_stops_counting_towards_the_allowance() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user_id = add_user(env, canister_ids.user_index, canister_ids.storage_index);
    start_upload(env, user_id, canister_ids.storage_index);
    tick_many(env, 10);
    assert_eq!(bytes_used(env, user_id, canister_ids.storage_index), 1000);

    // The bucket drops uploads which haven't completed within a day
    env.advance_time(Duration::from_millis(2 * DAY_IN_MS));
    wait_for_bytes_used(env, user_id, canister_ids.storage_index, 0);
}

// Uploads the first of the two chunks of a 1000 byte file
fn start_upload(env: &mut PocketIc, user_id: Principal, storage_index: CanisterId) {
    let mut bytes = vec![0; 1000];
    rand::rng().fill_bytes(&mut bytes);
    let bucket = client::storage_index::happy_path::allocated_bucket(env, user_id, storage_index, &bytes);

    let response = client::storage_bucket::upload_chunk_v2(
        env,
        user_id,
        bucket.canister_id,
        &storage_bucket_canister::upload_chunk_v2::Args {
            file_id: bucket.file_id,
            hash: hash_bytes(&bytes),
            mime_type: "video/mp4".to_string(),
            accessors: Vec::new(),
            chunk_index: 0,
            chunk_size: 500,
            total_size: 1000,
            bytes: bytes[..500].to_vec(),
            expiry: None,
            source_hash: None,
        },
    );
    assert!(matches!(
        response,
        storage_bucket_canister::upload_chunk_v2::Response::Success
    ));
}

fn add_user(env: &mut PocketIc, user_index: CanisterId, storage_index: CanisterId) -> Principal {
    let user_id = random_principal();
    client::storage_index::happy_path::add_or_update_users(
        env,
        user_index,
        storage_index,
        vec![UserConfig {
            user_id,
            byte_limit: 10_000,
        }],
    );
    user_id
}

fn bytes_used(env: &PocketIc, user_id: Principal, storage_index: CanisterId) -> u64 {
    client::storage_index::happy_path::user(env, user_id, storage_index).bytes_used
}

fn wait_for_bytes_used(env: &mut PocketIc, user_id: Principal, storage_index: CanisterId, expected: u64) {
    for _ in 0..30 {
        if bytes_used(env, user_id, storage_index) == expected {
            return;
        }
        env.tick();
    }
    assert_eq!(bytes_used(env, user_id, storage_index), expected);
}
