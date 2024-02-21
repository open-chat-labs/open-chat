use crate::env::ENV;
use crate::rng::{random_principal, random_string, random_user_principal};
use crate::utils::tick_many;
use crate::{client, TestEnv};
use rand::random;
use serde_bytes::ByteBuf;
use std::ops::Deref;
use types::Empty;

#[test]
fn register_via_identity_canister_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let (auth_principal, public_key) = random_user_principal();
    let session_key = ByteBuf::from(random::<[u8; 32]>().to_vec());

    let create_identity_result = client::identity::happy_path::create_identity(
        env,
        auth_principal,
        canister_ids.identity,
        public_key.clone(),
        session_key.clone(),
    );

    client::identity::happy_path::get_delegation(
        env,
        auth_principal,
        canister_ids.identity,
        session_key,
        create_identity_result.expiration,
    );

    let register_response = client::local_user_index::register_user(
        env,
        create_identity_result.principal,
        canister_ids.local_user_index,
        &local_user_index_canister::register_user::Args {
            public_key: create_identity_result.user_key,
            username: random_string(),
            referral_code: None,
        },
    );

    assert!(matches!(
        register_response,
        local_user_index_canister::register_user::Response::Success(_)
    ));
}

#[test]
fn delegation_signed_successfully() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    client::identity::happy_path::migrate_legacy_principal(env, user.principal, canister_ids.identity);

    let session_key = ByteBuf::from(random::<[u8; 32]>().to_vec());
    let prepare_result =
        client::identity::happy_path::prepare_delegation(env, user.principal, canister_ids.identity, session_key.clone());

    client::identity::happy_path::get_delegation(
        env,
        user.principal,
        canister_ids.identity,
        session_key,
        prepare_result.expiration,
    );
}

#[test]
fn new_users_synced_to_identity_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user_count = 5usize;

    let users: Vec<_> = (0..user_count)
        .map(|_| client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index))
        .collect();

    env.tick();

    for user in users {
        let response = client::identity::check_auth_principal(env, user.principal, canister_ids.identity, &Empty {});
        assert!(matches!(response, identity_canister::check_auth_principal::Response::Legacy));
    }
}

#[test]
fn migrate_principal_updates_principal_in_all_canisters() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let mut user = client::register_diamond_user(env, canister_ids, *controller);

    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), false, true);
    let community_id = client::user::happy_path::create_community(env, &user, &random_string(), false, vec![random_string()]);

    client::notifications_index::happy_path::push_subscription(
        env,
        user.principal,
        canister_ids.notifications_index,
        "auth",
        "p256dh",
        "endpoint",
    );
    let file_bytes = random_string().into_bytes();
    let allocated_bucket_response =
        client::storage_index::happy_path::allocated_bucket(env, user.principal, canister_ids.storage_index, &file_bytes);

    client::storage_bucket::happy_path::upload_file(
        env,
        user.principal,
        allocated_bucket_response.canister_id,
        allocated_bucket_response.file_id,
        file_bytes,
        None,
    );

    let new_principal = client::identity::happy_path::migrate_legacy_principal(env, user.principal, canister_ids.identity);

    user.principal = new_principal;

    tick_many(env, 5);

    client::user_index::happy_path::current_user(env, user.principal, canister_ids.user_index);
    client::user::happy_path::initial_state(env, &user);
    client::group::happy_path::summary(env, &user, group_id);
    client::community::happy_path::summary(env, &user, community_id);
    client::notifications_index::happy_path::subscription_exists(
        env,
        new_principal,
        canister_ids.notifications_index,
        "p256dh",
    );
    client::storage_index::happy_path::user(env, new_principal, canister_ids.storage_index);
    assert!(
        client::storage_bucket::happy_path::file_info(
            env,
            new_principal,
            allocated_bucket_response.canister_id,
            allocated_bucket_response.file_id
        )
        .is_owner
    );
}

#[test]
fn unknown_principal_returns_not_found() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let response = client::identity::check_auth_principal(env, random_principal(), canister_ids.identity, &Empty {});
    assert!(matches!(
        response,
        identity_canister::check_auth_principal::Response::NotFound
    ));
}
