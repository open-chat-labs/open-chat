use crate::client;
use crate::setup::{return_env, setup_env};

#[test]
fn register_users() {
    let (mut env, canister_ids) = setup_env();

    let user_count = 5usize;

    let users: Vec<_> = (0..user_count)
        .map(|_| client::user_index::happy_path::register_user(&mut env, canister_ids.user_index))
        .collect();

    let response = client::user_index::users(
        &env,
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

    return_env(env, canister_ids);
}
