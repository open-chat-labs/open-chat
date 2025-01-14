use crate::env::ENV;
use crate::utils::tick_many;
use crate::{client, TestEnv};
use std::ops::Deref;
use types::Empty;

#[test]
fn delete_user_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);

    env.tick();

    let delete_user_response = client::user_index::delete_user(
        env,
        user.principal,
        canister_ids.user_index,
        &user_index_canister::delete_user::Args { user_id: user.user_id },
    );

    assert!(matches!(
        delete_user_response,
        user_index_canister::delete_user::Response::Success
    ));

    tick_many(env, 3);

    let current_user_response = client::user_index::current_user(env, user.principal, canister_ids.user_index, &Empty {});

    assert!(matches!(
        current_user_response,
        user_index_canister::current_user::Response::UserNotFound
    ));

    let canister_status = env.canister_status(user.canister(), Some(user.local_user_index)).unwrap();
    assert!(canister_status.module_hash.is_none());
}

#[test]
fn deleted_user_removed_from_online_users_canister() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);

    env.tick();

    client::online_users::happy_path::mark_as_online(env, user.principal, canister_ids.online_users);

    assert_eq!(
        client::online_users::happy_path::last_online(env, vec![user.user_id], canister_ids.online_users).len(),
        1
    );

    let delete_user_response = client::user_index::delete_user(
        env,
        user.principal,
        canister_ids.user_index,
        &user_index_canister::delete_user::Args { user_id: user.user_id },
    );

    assert!(matches!(
        delete_user_response,
        user_index_canister::delete_user::Response::Success
    ));

    tick_many(env, 3);

    assert!(client::online_users::happy_path::last_online(env, vec![user.user_id], canister_ids.online_users).is_empty(),);
}
