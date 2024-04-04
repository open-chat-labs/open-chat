use crate::env::ENV;
use crate::rng::{random_principal, random_string};
use crate::utils::tick_many;
use crate::{client, TestEnv};
use rand::random;
use serde_bytes::ByteBuf;
use std::ops::Deref;
use types::{DiamondMembershipPlanDuration, Empty};

#[test]
fn delegation_signed_successfully() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::local_user_index::happy_path::register_legacy_user(env, canister_ids.local_user_index);

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
        .map(|_| client::local_user_index::happy_path::register_legacy_user(env, canister_ids.local_user_index))
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

    let mut user = client::local_user_index::happy_path::register_legacy_user(env, canister_ids.local_user_index);
    client::upgrade_user(&user, env, canister_ids, *controller, DiamondMembershipPlanDuration::OneMonth);

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
fn principal_migration_job_migrates_all_principals() {
    let mut wrapper = ENV.deref().get_new();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let platform_operator = client::local_user_index::happy_path::register_legacy_user(env, canister_ids.local_user_index);

    env.tick();

    let new_platform_operator_principal =
        client::identity::happy_path::migrate_legacy_principal(env, platform_operator.principal, canister_ids.identity);

    let users: Vec<_> = (0..5)
        .map(|_| client::local_user_index::happy_path::register_legacy_user(env, canister_ids.local_user_index))
        .collect();

    env.tick();

    client::user_index::happy_path::add_platform_operator(env, *controller, canister_ids.user_index, platform_operator.user_id);

    assert!(users.iter().all(|u| {
        matches!(
            client::identity::check_auth_principal(env, u.principal, canister_ids.identity, &Empty {}),
            identity_canister::check_auth_principal::Response::Legacy
        )
    }));

    client::identity::happy_path::set_principal_migration_job_enabled(
        env,
        new_platform_operator_principal,
        canister_ids.identity,
        true,
    );

    tick_many(env, 5);

    client::identity::happy_path::set_principal_migration_job_enabled(
        env,
        new_platform_operator_principal,
        canister_ids.identity,
        false,
    );

    assert!(users.iter().all(|u| {
        matches!(
            client::identity::check_auth_principal(env, u.principal, canister_ids.identity, &Empty {}),
            identity_canister::check_auth_principal::Response::Success
        )
    }));
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
