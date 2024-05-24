use crate::env::ENV;
use crate::{client, TestEnv};
use itertools::Itertools;
use std::ops::Deref;
use testing::rng::{random_delegated_principal, random_string};

#[test]
fn register_users() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user_count = 5usize;

    let users: Vec<_> = (0..user_count).map(|_| client::register_user(env, canister_ids)).collect();

    let user_summaries = client::user_index::happy_path::users(
        env,
        users[0].principal,
        canister_ids.user_index,
        users.iter().map(|u| u.user_id).collect(),
    );

    assert_eq!(user_summaries.len(), user_count);
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
        let (principal, public_key) = random_delegated_principal(canister_ids.identity);
        if first_user_principal.is_none() {
            first_user_principal = Some(principal);
        }
        let response = client::local_user_index::register_user(
            env,
            principal,
            canister_ids.local_user_index,
            &local_user_index_canister::register_user::Args {
                username: username.clone(),
                referral_code: None,
                public_key,
            },
        );
        if let local_user_index_canister::register_user::Response::Success(res) = response {
            user_ids.push(res.user_id);
        } else {
            panic!()
        }
    }

    env.tick();

    let user_summaries =
        client::user_index::happy_path::users(env, first_user_principal.unwrap(), canister_ids.user_index, user_ids);

    let usernames: Vec<_> = user_summaries.into_iter().map(|u| u.username).sorted_unstable().collect();

    let expected_usernames: Vec<_> = (1..=user_count)
        .map(|i| if i == 1 { username.clone() } else { format!("{username}{i}") })
        .collect();

    assert_eq!(usernames, expected_usernames);
}
