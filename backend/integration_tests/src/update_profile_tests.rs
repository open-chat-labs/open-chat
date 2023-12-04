use crate::env::ENV;
use crate::rng::random_string;
use crate::utils::{now_millis, tick_many};
use crate::{client, TestEnv};
use std::ops::Deref;
use std::time::Duration;
use types::OptionUpdate;

#[test]
fn update_username_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    env.advance_time(Duration::from_secs(10));

    let username = random_string();

    client::user_index::happy_path::set_username(env, user.principal, canister_ids.user_index, username.clone());

    tick_many(env, 3);

    // Check that the user index is updated
    let user_summary = client::user_index::happy_path::users(env, user.principal, canister_ids.user_index, vec![user.user_id])
        .pop()
        .unwrap();
    assert_eq!(user_summary.username, username);

    // Check that the user canister is updated
    let now = now_millis(env);
    let updates = client::user::happy_path::updates(env, &user, now - 1);
    assert_eq!(updates.unwrap().username, Some(username));
}

#[test]
fn update_display_name_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);

    env.advance_time(Duration::from_secs(10));

    let display_name = random_string();

    client::user_index::happy_path::set_display_name(env, user.principal, canister_ids.user_index, Some(display_name.clone()));

    tick_many(env, 3);

    // Check that the user index is updated
    let user_summary = client::user_index::happy_path::users(env, user.principal, canister_ids.user_index, vec![user.user_id])
        .pop()
        .unwrap();
    assert_eq!(user_summary.display_name, Some(display_name.clone()));

    // Check that the user canister is updated
    let now = now_millis(env);
    let updates = client::user::happy_path::updates(env, &user, now - 1);
    assert_eq!(updates.unwrap().display_name, OptionUpdate::SetToSome(display_name));
}

#[test]
fn update_display_name_unauthorized_if_not_diamond_member() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    env.advance_time(Duration::from_secs(10));

    let display_name = random_string();

    let response = client::user_index::set_display_name(
        env,
        user.principal,
        canister_ids.user_index,
        &user_index_canister::set_display_name::Args {
            display_name: Some(display_name.clone()),
        },
    );

    assert!(matches!(
        response,
        user_index_canister::set_display_name::Response::Unauthorized
    ));
}
