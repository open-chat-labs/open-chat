use crate::client;
use crate::rng::random_principal;
use crate::setup::{return_env, setup_env, TestEnv};
use std::time::Duration;

#[test]
fn set_then_get_last_online_date_succeeds() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let user1 = client::user_index::happy_path::register_user(&mut env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(&mut env, canister_ids.user_index);

    let mark_online_response = client::online_users::mark_as_online(
        &mut env,
        user1.principal,
        canister_ids.online_users,
        &online_users_canister::mark_as_online::Args {},
    );
    assert!(matches!(
        mark_online_response,
        online_users_canister::mark_as_online::Response::Success
    ));

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    let online_users_canister::last_online::Response::Success(users) = client::online_users::last_online(
        &env,
        random_principal(),
        canister_ids.online_users,
        &online_users_canister::last_online::Args {
            user_ids: vec![user1.user_id, user2.user_id],
        },
    );
    assert_eq!(users.len(), 1);
    assert_eq!(users[0].user_id, user1.user_id);
    assert_eq!(users[0].duration_since_last_online, 1000);

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}
