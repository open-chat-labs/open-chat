use crate::env::ENV;
use crate::utils::now_millis;
use crate::{client, TestEnv};
use constants::MINUTE_IN_MS;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_principal;

#[test]
fn set_then_get_last_online_date_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    client::online_users::happy_path::mark_as_online(env, user1.principal, canister_ids.online_users);

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    let online_users_canister::last_online::Response::Success(users) = client::online_users::last_online(
        env,
        random_principal(),
        canister_ids.online_users,
        &online_users_canister::last_online::Args {
            user_ids: vec![user1.user_id, user2.user_id],
        },
    );
    assert_eq!(users.len(), 1);
    assert_eq!(users[0].user_id, user1.user_id);
    assert_eq!(users[0].duration_since_last_online, 1000);
}

#[test]
fn mark_online_pushes_event() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_user(env, canister_ids);

    env.advance_time(Duration::from_millis(5 * MINUTE_IN_MS));
    env.tick();
    env.advance_time(Duration::from_millis(MINUTE_IN_MS));
    env.tick();

    let timestamp = now_millis(env);
    client::online_users::happy_path::mark_as_online(env, user.principal, canister_ids.online_users);

    env.advance_time(Duration::from_millis(MINUTE_IN_MS));
    env.tick();
    env.advance_time(Duration::from_millis(MINUTE_IN_MS));
    env.tick();
    env.tick();

    let latest_event_index = client::event_store::happy_path::events(env, *controller, canister_ids.event_store, 0, 0)
        .latest_event_index
        .unwrap();

    let latest_event =
        client::event_store::happy_path::events(env, *controller, canister_ids.event_store, latest_event_index, 1)
            .events
            .pop()
            .unwrap();

    assert_eq!(latest_event.name, "user_online");
    assert_eq!(latest_event.timestamp, timestamp);
}
