//! Every canister takes another canister's events at an endpoint named `c2c_<caller>`. These check
//! the endpoints added under that name ahead of their callers switching over to them, each by
//! sending one event as the caller and reading its effect back. The Group, Community and DailyPuzzle
//! canisters refuse every `c2c_` call made by ingress, so theirs are covered once their callers
//! switch over.
use crate::env::ENV;
use crate::utils::{now_millis, tick_until};
use crate::{TestEnv, client};
use candid::Principal;
use rand::random;
use std::ops::Deref;
use storage_index_canister::add_or_update_users::UserConfig;
use testing::rng::{random_from_principal, random_internet_identity_principal, random_principal};
use types::{Empty, IdempotentEnvelope, SuccessOnly, UserId};

#[test]
fn local_user_index_takes_user_index_events() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let local_user_index = canister_ids.subnets[0].local_user_index;
    let old_user_id: UserId = random_from_principal();
    let new_user_id: UserId = random_from_principal();

    let response = client::local_user_index::c2c_user_index(
        env,
        canister_ids.user_index,
        local_user_index,
        &local_user_index_canister::c2c_user_index::Args {
            events: vec![envelope(
                env,
                local_user_index_canister::UserIndexEvent::UserIdMigrated(local_user_index_canister::UserIdMigrated {
                    old_user_id,
                    new_user_id,
                }),
            )],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));

    let local_user_index_canister::migrated_user_ids::Response::Success(migrated) = client::local_user_index::migrated_user_ids(
        env,
        Principal::anonymous(),
        local_user_index,
        &local_user_index_canister::migrated_user_ids::Args {
            user_ids: vec![old_user_id],
        },
    );
    assert_eq!(migrated.get(&old_user_id), Some(&new_user_id));
}

#[test]
fn identity_takes_user_index_events() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let (auth_principal, public_key) = random_internet_identity_principal();
    let session_key = random::<[u8; 32]>().to_vec();
    let created = client::identity::happy_path::create_identity(
        env,
        auth_principal,
        canister_ids.identity,
        public_key,
        session_key,
        true,
    );
    let oc_principal = Principal::self_authenticating(created.user_key);
    let user_id: UserId = random_from_principal();

    let response = client::identity::c2c_user_index(
        env,
        canister_ids.user_index,
        canister_ids.identity,
        &identity_canister::c2c_user_index::Args {
            events: vec![envelope(
                env,
                identity_canister::UserIndexEvent::SetUserIdentity(identity_canister::UserIdentity {
                    principal: oc_principal,
                    user_id: Some(user_id),
                    email: None,
                }),
            )],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));

    let response = client::identity::check_auth_principal_v2(env, auth_principal, canister_ids.identity, &Empty {});
    let identity_canister::check_auth_principal_v2::Response::Success(result) = response else {
        panic!("Auth principal not found");
    };
    assert_eq!(result.user_id, Some(user_id));
}

#[test]
fn storage_index_takes_user_index_events() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user_id = random_principal();

    let response = client::storage_index::c2c_user_index(
        env,
        canister_ids.user_index,
        canister_ids.storage_index,
        &storage_index_canister::c2c_user_index::Args {
            events: vec![envelope(
                env,
                storage_index_canister::UserIndexEvent::AddOrUpdateUser(UserConfig {
                    user_id,
                    byte_limit: 12345,
                }),
            )],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));
    assert_eq!(
        client::storage_index::happy_path::user(env, user_id, canister_ids.storage_index).byte_limit,
        12345
    );

    let response = client::storage_index::c2c_user_index(
        env,
        canister_ids.user_index,
        canister_ids.storage_index,
        &storage_index_canister::c2c_user_index::Args {
            events: vec![envelope(env, storage_index_canister::UserIndexEvent::RemoveUser(user_id))],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));
    let response = client::storage_index::user(
        env,
        user_id,
        canister_ids.storage_index,
        &storage_index_canister::user::Args {},
    );
    assert!(
        matches!(response, storage_index_canister::user::Response::UserNotFound),
        "{response:?}"
    );
}

#[test]
fn storage_index_takes_group_index_events() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user_id = add_uploader(env, canister_ids);
    let accessor = random_principal();
    let file = client::storage_index::happy_path::upload_file(env, user_id, canister_ids.storage_index, 500, vec![accessor]);
    assert!(client::storage_bucket::happy_path::file_exists(
        env,
        user_id,
        file.canister_id,
        file.blob_id
    ));

    let response = client::storage_index::c2c_group_index(
        env,
        canister_ids.group_index,
        canister_ids.storage_index,
        &storage_index_canister::c2c_group_index::Args {
            events: vec![envelope(
                env,
                storage_index_canister::GroupIndexEvent::RemoveAccessor(accessor),
            )],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));

    tick_until(env, |env| {
        !client::storage_bucket::happy_path::file_exists(env, user_id, file.canister_id, file.blob_id)
    });
}

#[test]
fn storage_bucket_takes_storage_index_events() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user_id = add_uploader(env, canister_ids);
    let file = client::storage_index::happy_path::upload_file(env, user_id, canister_ids.storage_index, 500, Vec::new());
    tick_until(env, |env| {
        client::storage_index::happy_path::user(env, user_id, canister_ids.storage_index).bytes_used == 500
    });

    let response = client::storage_bucket::c2c_storage_index(
        env,
        canister_ids.storage_index,
        file.canister_id,
        &storage_bucket_canister::c2c_storage_index::Args {
            events: vec![envelope(
                env,
                storage_bucket_canister::StorageIndexEvent::FileToRemove(file.blob_id),
            )],
        },
    );
    assert!(matches!(response, SuccessOnly::Success));
    assert!(!client::storage_bucket::happy_path::file_exists(
        env,
        user_id,
        file.canister_id,
        file.blob_id
    ));

    // The bucket tells the index of the removal through its own events rather than in the response
    tick_until(env, |env| {
        client::storage_index::happy_path::user(env, user_id, canister_ids.storage_index).bytes_used == 0
    });
}

// Stamped with the current time, since a receiver drops an event older than the latest it has had
// from the same sender
fn envelope<T>(env: &pocket_ic::PocketIc, value: T) -> IdempotentEnvelope<T> {
    IdempotentEnvelope {
        created_at: now_millis(env),
        idempotency_id: random(),
        value,
    }
}

fn add_uploader(env: &mut pocket_ic::PocketIc, canister_ids: &crate::CanisterIds) -> Principal {
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
    user_id
}
