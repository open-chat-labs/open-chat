use crate::env::ENV;
use crate::rng::random_principal;
use crate::{client, TestEnv};
use std::ops::Deref;
use types::Empty;

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
        let response = client::identity::check_principal(env, user.principal, canister_ids.identity, &Empty {});
        assert!(matches!(response, identity_canister::check_principal::Response::Legacy));
    }
}

#[test]
fn unknown_principal_returns_not_found() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let response = client::identity::check_principal(env, random_principal(), canister_ids.identity, &Empty {});
    assert!(matches!(response, identity_canister::check_principal::Response::NotFound));
}
