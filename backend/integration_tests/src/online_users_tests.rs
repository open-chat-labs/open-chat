use crate::env::ENV;
use crate::utils::now_millis;
use crate::{TestEnv, client};
use constants::MINUTE_IN_MS;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_principal;
use utils::time::MonthKey;

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

    // The event store is shared with every other test running against this env, so events from
    // unrelated tests can land after ours. Look for our event among the most recent ones rather
    // than asserting it is the very latest.
    let latest_event_index = client::event_store::happy_path::events(env, *controller, canister_ids.event_store, 0, 0)
        .latest_event_index
        .unwrap();

    let window = 100;
    let events = client::event_store::happy_path::events(
        env,
        *controller,
        canister_ids.event_store,
        latest_event_index.saturating_sub(window),
        window + 1,
    )
    .events;

    assert!(
        events.iter().any(|e| e.name == "user_online" && e.timestamp == timestamp),
        "no user_online event at {timestamp} in the last {window} events: {:?}",
        events.iter().map(|e| (e.name.as_str(), e.timestamp)).collect::<Vec<_>>()
    );
}

#[test]
fn online_minutes_tracked_correctly() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let now = now_millis(env);
    let month_temp = MonthKey::from_timestamp(now);

    // Go to the start of next month so that each time we advance time we stay within the same month
    env.advance_time(Duration::from_millis(
        1 + month_temp.timestamp_range().end.saturating_sub(now),
    ));

    let month = month_temp.next();

    for i in 1..10 {
        client::online_users::happy_path::mark_as_online(env, user.principal, canister_ids.online_users);

        env.tick();

        assert_eq!(
            i,
            client::online_users::happy_path::minutes_online(
                env,
                user.principal,
                canister_ids.online_users,
                month.year(),
                month.month()
            )
        );

        env.advance_time(Duration::from_secs(60));
    }
}
