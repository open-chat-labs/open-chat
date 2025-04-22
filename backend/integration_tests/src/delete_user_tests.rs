use crate::client::register_user_and_include_auth;
use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, client};
use candid::Principal;
use oc_error_codes::OCErrorCode;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use types::{Empty, Milliseconds};

#[test_case(0, true)]
#[test_case(299_999, true)]
#[test_case(300_001, false)]
fn delete_user_succeeds_if_signed_in_recently(delay: Milliseconds, should_delete_user: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let (user, user_auth) = register_user_and_include_auth(env, canister_ids);

    env.advance_time(Duration::from_millis(delay));

    let delete_user_response = client::identity::delete_user(
        env,
        user_auth.auth_principal,
        canister_ids.identity,
        &identity_canister::delete_user::Args {
            public_key: user_auth.public_key,
            delegation: user_auth.delegation,
        },
    );

    if should_delete_user {
        assert!(
            matches!(delete_user_response, identity_canister::delete_user::Response::Success),
            "{delete_user_response:?}"
        );
    } else {
        assert!(matches!(
            delete_user_response,
            identity_canister::delete_user::Response::Error(e) if e.matches_code(OCErrorCode::DelegationTooOld)
        ));
    }

    tick_many(env, 3);

    let current_user_response = client::user_index::current_user(env, user.principal, canister_ids.user_index, &Empty {});

    if should_delete_user {
        assert!(matches!(
            current_user_response,
            user_index_canister::current_user::Response::UserNotFound
        ));
    } else {
        assert!(matches!(
            current_user_response,
            user_index_canister::current_user::Response::Success(_)
        ));
    }

    let canister_status = env.canister_status(user.canister(), Some(user.local_user_index)).unwrap();
    assert_eq!(canister_status.module_hash.is_none(), should_delete_user);
}

#[test]
fn deleted_user_removed_from_online_users_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let (user, user_auth) = register_user_and_include_auth(env, canister_ids);

    env.tick();

    client::online_users::happy_path::mark_as_online(env, user.principal, canister_ids.online_users);

    assert_eq!(
        client::online_users::happy_path::last_online(env, vec![user.user_id], canister_ids.online_users).len(),
        1
    );

    client::identity::happy_path::delete_user(env, &user_auth, canister_ids.identity);

    tick_many(env, 3);

    assert!(client::online_users::happy_path::last_online(env, vec![user.user_id], canister_ids.online_users).is_empty(),);
}

#[test]
fn deleted_user_removed_from_storage_index_and_files_deleted() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let (user, user_auth) = register_user_and_include_auth(env, canister_ids);

    env.tick();

    let file =
        client::storage_index::happy_path::upload_file(env, user.principal, canister_ids.storage_index, 1000, Vec::new());

    assert!(client::storage_bucket::happy_path::file_exists(
        env,
        Principal::anonymous(),
        file.canister_id,
        file.blob_id
    ));

    client::identity::happy_path::delete_user(env, &user_auth, canister_ids.identity);

    tick_many(env, 3);

    let storage_user_response = client::storage_index::user(env, user.principal, canister_ids.storage_index, &Empty {});
    assert!(matches!(
        storage_user_response,
        storage_index_canister::user::Response::UserNotFound
    ));

    assert!(!client::storage_bucket::happy_path::file_exists(
        env,
        Principal::anonymous(),
        file.canister_id,
        file.blob_id
    ));
}
