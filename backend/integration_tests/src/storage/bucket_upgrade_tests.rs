use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::utils::{tick_many, tick_until};
use crate::{TestEnv, client, wasms};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use storage_bucket_canister::delete_file;
use storage_index_canister::add_or_update_users::UserConfig;
use testing::rng::random_principal;
use types::{CanisterId, CanisterWasm};

// Events a bucket on the prod wasm has queued for the StorageIndex, which it couldn't send because the
// index was stopped, are sent once the bucket has been upgraded: the post_upgrade one-off moves them
// onto the queue to `c2c_storage_bucket`, and the old queue never sends anything itself.
// The env is set up on the current wasm and the bucket moved onto the prod one, which needs the prod
// wasm to read the current wasm's state, so this goes with the one-off in the tidy, which removes
// fields the prod wasm requires.
#[test]
fn events_queued_by_the_prod_bucket_are_sent_after_the_upgrade() {
    // A new env, since this stops the StorageIndex
    let mut wrapper = ENV.deref().create_new();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();
    let storage_index = canister_ids.storage_index;

    let user_id = random_principal();
    client::storage_index::happy_path::add_or_update_users(
        env,
        canister_ids.user_index,
        storage_index,
        vec![UserConfig {
            user_id,
            byte_limit: 10_000,
        }],
    );
    let file = client::storage_index::happy_path::upload_file(env, user_id, storage_index, 500, Vec::new());
    tick_until(env, |env| bytes_used(env, user_id, storage_index) == 500);

    // The StorageIndex controls its buckets
    upgrade_bucket(env, storage_index, file.canister_id, wasms::STORAGE_BUCKET_PROD.clone());

    // The file's deletion, made while the index is stopped, is queued for it by the prod bucket
    stop_canister(env, *controller, storage_index);
    let response =
        client::storage_bucket::delete_file(env, user_id, file.canister_id, &delete_file::Args { file_id: file.blob_id });
    assert!(matches!(response, delete_file::Response::Success));
    tick_many(env, 3);

    upgrade_bucket(env, storage_index, file.canister_id, wasms::STORAGE_BUCKET.clone());
    start_canister(env, *controller, storage_index);

    tick_until(env, |env| bytes_used(env, user_id, storage_index) == 0);

    wrapper.discard();
}

fn upgrade_bucket(env: &mut PocketIc, controller: Principal, bucket: CanisterId, wasm: CanisterWasm) {
    let args = candid::encode_one(storage_bucket_canister::post_upgrade::Args {
        wasm_version: wasm.version,
    })
    .unwrap();
    stop_canister(env, controller, bucket);
    env.upgrade_canister(bucket, wasm.module.into(), args, Some(controller))
        .unwrap();
    start_canister(env, controller, bucket);
}

fn bytes_used(env: &PocketIc, user_id: Principal, storage_index: CanisterId) -> u64 {
    client::storage_index::happy_path::user(env, user_id, storage_index).bytes_used
}
