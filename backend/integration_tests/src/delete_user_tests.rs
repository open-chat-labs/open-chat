use crate::env::ENV;
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

    env.tick();

    let current_user_response = client::user_index::current_user(env, user.principal, canister_ids.user_index, &Empty {});

    assert!(matches!(
        current_user_response,
        user_index_canister::current_user::Response::UserNotFound
    ));
}
