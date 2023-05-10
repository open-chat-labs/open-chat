use crate::env::ENV;
use crate::rng::{random_string, random_user_principal};
use crate::{client, TestEnv};
use itertools::Itertools;
use std::ops::Deref;

#[test]
fn register_users() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user_count = 5usize;

    let users: Vec<_> = (0..user_count)
        .map(|_| client::user_index::happy_path::register_user(env, canister_ids.user_index))
        .collect();

    let response = client::user_index::users(
        env,
        users[0].principal,
        canister_ids.user_index,
        &user_index_canister::users::Args {
            user_groups: vec![user_index_canister::users::UserGroup {
                users: users.iter().map(|u| u.user_id).collect(),
                updated_since: 0,
            }],
        },
    );

    let user_index_canister::users::Response::Success(result) = response;
    assert_eq!(result.users.len(), user_count);
}

#[test]
fn register_user_with_duplicate_username_appends_suffix() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let username = random_string();
    let user_count = 5usize;
    let mut user_ids = Vec::new();
    let mut first_user_principal = None;

    for _ in 0..user_count {
        let (principal, public_key) = random_user_principal();
        if first_user_principal.is_none() {
            first_user_principal = Some(principal);
        }
        let response = client::user_index::register_user_v2(
            env,
            principal,
            canister_ids.user_index,
            &user_index_canister::register_user_v2::Args {
                username: username.clone(),
                referral_code: None,
                public_key,
            },
        );
        if let user_index_canister::register_user_v2::Response::Success(user_id) = response {
            user_ids.push(user_id);
        } else {
            panic!()
        }
    }

    let response = client::user_index::users(
        env,
        first_user_principal.unwrap(),
        canister_ids.user_index,
        &user_index_canister::users::Args {
            user_groups: vec![user_index_canister::users::UserGroup {
                users: user_ids,
                updated_since: 0,
            }],
        },
    );

    let user_index_canister::users::Response::Success(result) = response;

    let usernames: Vec<_> = result.users.into_iter().flat_map(|u| u.username).sorted_unstable().collect();

    let expected_usernames: Vec<_> = (1..=user_count)
        .map(|i| if i == 1 { username.clone() } else { format!("{username}{i}") })
        .collect();

    assert_eq!(usernames, expected_usernames);
}
