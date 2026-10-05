use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{TestEnv, client, wasms};
use candid::Principal;
use constants::DAY_IN_MS;
use pocket_ic::PocketIc;
use rand::Rng;
use std::ops::Deref;
use std::time::Duration;
use storage_index_canister::add_or_update_users::UserConfig;
use testing::rng::random_principal;
use types::{CanisterId, FileAdded, FileId, FileMetaData, FileRemoved, TimestampMillis};
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

#[test]
fn file_references_whose_files_are_gone_are_removed_once_the_index_is_upgraded() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user_id = add_user(env, canister_ids.user_index, canister_ids.storage_index);
    let other_user_id = add_user(env, canister_ids.user_index, canister_ids.storage_index);
    let file = client::storage_index::happy_path::upload_file(env, user_id, canister_ids.storage_index, 500, Vec::new());
    start_upload(env, user_id, canister_ids.storage_index);
    tick_many(env, 10);

    // A reference to a file the bucket doesn't hold, as was left behind when the index ignored the
    // files the buckets reported removing, and a reference to a file the bucket holds as another
    // user's, as a forwarded file was reported to the index
    let now = now_millis(env);
    let response = client::storage_index::c2c_sync_bucket(
        env,
        file.canister_id,
        canister_ids.storage_index,
        &storage_index_canister::c2c_sync_bucket::Args {
            files_added: vec![
                file_added(rand::random(), user_id, now, 300),
                file_added(file.blob_id, other_user_id, now, 200),
            ],
            ..Default::default()
        },
    );
    let storage_index_canister::c2c_sync_bucket::Response::Success(result) = response;
    assert!(result.files_rejected.is_empty());
    assert_eq!(bytes_used(env, user_id, canister_ids.storage_index), 1800);
    assert_eq!(bytes_used(env, other_user_id, canister_ids.storage_index), 200);

    // The index checks every file reference against its bucket once upgraded
    upgrade_storage_index(env, *controller, canister_ids.storage_index);

    // The uploaded file and the upload in progress still count
    wait_for_bytes_used(env, user_id, canister_ids.storage_index, 1500);
    wait_for_bytes_used(env, other_user_id, canister_ids.storage_index, 0);
    assert!(client::storage_bucket::happy_path::file_exists(
        env,
        user_id,
        file.canister_id,
        file.blob_id
    ));

    // The index's reconciliation has now run, which a later upgrade wouldn't repeat
    wrapper.discard();
}

#[test]
fn files_without_a_reference_are_charged_to_their_owners_once_the_index_is_upgraded() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let owner = add_user(env, canister_ids.user_index, canister_ids.storage_index);
    let forwarder = add_user(env, canister_ids.user_index, canister_ids.storage_index);
    let other_forwarder = add_user(env, canister_ids.user_index, canister_ids.storage_index);

    // The forwarder's own files, both older than the file they forward
    let oldest = client::storage_index::happy_path::upload_file(env, forwarder, canister_ids.storage_index, 1000, Vec::new());
    env.advance_time(Duration::from_millis(1));
    let older = client::storage_index::happy_path::upload_file(env, forwarder, canister_ids.storage_index, 1000, Vec::new());
    env.advance_time(Duration::from_millis(1));
    let file = client::storage_index::happy_path::upload_file(env, owner, canister_ids.storage_index, 1000, Vec::new());
    tick_many(env, 10);

    let forwarded = forward_file(env, forwarder, file.canister_id, file.blob_id);
    let other_forwarded = forward_file(env, other_forwarder, file.canister_id, file.blob_id);
    tick_many(env, 10);
    assert_eq!(bytes_used(env, forwarder, canister_ids.storage_index), 3000);
    assert_eq!(bytes_used(env, other_forwarder, canister_ids.storage_index), 1000);

    // The forwarded copies lose their references, as the reconciliation removed them in prod
    let response = client::storage_index::c2c_sync_bucket(
        env,
        file.canister_id,
        canister_ids.storage_index,
        &storage_index_canister::c2c_sync_bucket::Args {
            files_removed: vec![forwarded.clone(), other_forwarded.clone()],
            ..Default::default()
        },
    );
    let storage_index_canister::c2c_sync_bucket::Response::Success(_) = response;
    assert_eq!(bytes_used(env, forwarder, canister_ids.storage_index), 2000);
    assert_eq!(bytes_used(env, other_forwarder, canister_ids.storage_index), 0);

    // The forwarder is already over their limit, as when a Diamond membership lapses
    client::storage_index::happy_path::add_or_update_users(
        env,
        canister_ids.user_index,
        canister_ids.storage_index,
        vec![UserConfig {
            user_id: forwarder,
            byte_limit: 500,
        }],
    );

    // Once upgraded, the index charges each forwarder for their copy. The forwarder is over their
    // limit so loses their oldest file, but no more than the 1000 bytes they were charged.
    upgrade_storage_index(env, *controller, canister_ids.storage_index);

    let mut oldest_removed = false;
    for _ in 0..60 {
        if !client::storage_bucket::happy_path::file_exists(env, forwarder, oldest.canister_id, oldest.blob_id) {
            oldest_removed = true;
            break;
        }
        // The files are only removed once the reconciliation has completed, which is checked every minute
        env.advance_time(Duration::from_secs(5));
        env.tick();
    }
    assert!(oldest_removed);
    wait_for_bytes_used(env, forwarder, canister_ids.storage_index, 2000);
    wait_for_bytes_used(env, other_forwarder, canister_ids.storage_index, 1000);
    assert_eq!(bytes_used(env, owner, canister_ids.storage_index), 1000);
    for (sender, bucket, file_id) in [
        (forwarder, older.canister_id, older.blob_id),
        (forwarder, file.canister_id, forwarded.file_id),
        (other_forwarder, file.canister_id, other_forwarded.file_id),
        (owner, file.canister_id, file.blob_id),
    ] {
        assert!(client::storage_bucket::happy_path::file_exists(env, sender, bucket, file_id));
    }

    // The index's backfill has now run, which a later upgrade wouldn't repeat
    wrapper.discard();
}

fn upgrade_storage_index(env: &mut PocketIc, controller: Principal, storage_index: CanisterId) {
    let wasm = wasms::STORAGE_INDEX.clone();
    let args = candid::encode_one(storage_index_canister::post_upgrade::Args {
        wasm_version: wasm.version,
    })
    .unwrap();
    client::stop_canister(env, controller, storage_index);
    env.upgrade_canister(storage_index, wasm.module.into(), args, Some(controller))
        .unwrap();
    client::start_canister(env, controller, storage_index);
}

// Forwards the file, returning the copy as its bucket would report removing it
fn forward_file(env: &mut PocketIc, sender: Principal, bucket: CanisterId, file_id: FileId) -> FileRemoved {
    let created = now_millis(env);
    let response = client::storage_bucket::forward_file(
        env,
        sender,
        bucket,
        &storage_bucket_canister::forward_file::Args {
            file_id,
            accessors: Vec::new(),
        },
    );
    let storage_bucket_canister::forward_file::Response::Success(forwarded_file_id) = response else {
        panic!("'forward_file' error: {response:?}");
    };
    FileRemoved {
        file_id: forwarded_file_id,
        meta_data: FileMetaData { owner: sender, created },
    }
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

fn file_added(file_id: FileId, owner: Principal, created: TimestampMillis, size: u64) -> FileAdded {
    FileAdded {
        file_id,
        hash: rand::random(),
        size,
        meta_data: FileMetaData { owner, created },
    }
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
