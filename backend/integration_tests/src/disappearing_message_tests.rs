use crate::client::group::CHAT_EVENTS_MEMORY_ID;
use crate::env::ENV;
use crate::stable_memory::count_stable_memory_event_keys;
use crate::{client, TestEnv};
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::{EventIndex, MessageIndex, OptionUpdate};

#[test]
fn disappearing_messages_in_group_chats() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), false, true);

    client::group::update_group_v2(
        env,
        user.principal,
        group_id.into(),
        &group_canister::update_group_v2::Args {
            events_ttl: OptionUpdate::SetToSome(1000),
            ..Default::default()
        },
    );

    let send_message_response1 =
        client::group::happy_path::send_text_message(env, &user, group_id, None, random_string(), None);

    for _ in 0..5 {
        client::group::happy_path::send_text_message(env, &user, group_id, None, random_string(), None);
    }

    assert!(
        client::group::happy_path::events_by_index(env, &user, group_id, vec![send_message_response1.event_index])
            .events
            .first()
            .is_some()
    );

    env.advance_time(Duration::from_millis(2000));
    env.tick();

    let expected_expired_events_range = (
        send_message_response1.event_index,
        EventIndex::from(u32::from(send_message_response1.event_index) + 5),
    );
    let expected_expired_messages_range = (
        send_message_response1.message_index,
        MessageIndex::from(u32::from(send_message_response1.message_index) + 5),
    );

    let events_by_index_response =
        client::group::happy_path::events_by_index(env, &user, group_id, vec![send_message_response1.event_index]);
    assert!(events_by_index_response.events.first().is_none());
    assert_eq!(
        *events_by_index_response.expired_event_ranges.first().unwrap(),
        expected_expired_events_range
    );
    assert_eq!(
        *events_by_index_response.expired_message_ranges.first().unwrap(),
        expected_expired_messages_range
    );

    let events_window_response =
        client::group::happy_path::events_window(env, &user, group_id, send_message_response1.message_index, 10, 10);
    assert!(!events_window_response.events.is_empty());
    assert_eq!(
        *events_window_response.expired_event_ranges.first().unwrap(),
        expected_expired_events_range
    );
    assert_eq!(
        *events_window_response.expired_message_ranges.first().unwrap(),
        expected_expired_messages_range
    );

    client::group::update_group_v2(
        env,
        user.principal,
        group_id.into(),
        &group_canister::update_group_v2::Args {
            events_ttl: OptionUpdate::SetToNone,
            ..Default::default()
        },
    );

    let send_message_response2 = client::group::happy_path::send_text_message(env, &user, group_id, None, "xyz", None);

    env.advance_time(Duration::from_secs(100000));
    env.tick();

    assert!(
        client::group::happy_path::events_by_index(env, &user, group_id, vec![send_message_response2.event_index])
            .events
            .first()
            .is_some()
    );
}

#[test]
fn expired_event_and_message_ranges_are_correct() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), false, true);

    client::group::update_group_v2(
        env,
        user.principal,
        group_id.into(),
        &group_canister::update_group_v2::Args {
            events_ttl: OptionUpdate::SetToSome(1000),
            ..Default::default()
        },
    );

    let send_message_response1 =
        client::group::happy_path::send_text_message(env, &user, group_id, None, random_string(), None);

    for _ in 0..3 {
        client::group::happy_path::send_text_message(env, &user, group_id, None, random_string(), None);
    }

    client::group::update_group_v2(
        env,
        user.principal,
        group_id.into(),
        &group_canister::update_group_v2::Args {
            name: Some(random_string()),
            ..Default::default()
        },
    );

    for _ in 0..3 {
        client::group::happy_path::send_text_message(env, &user, group_id, None, random_string(), None);
    }

    client::group::update_group_v2(
        env,
        user.principal,
        group_id.into(),
        &group_canister::update_group_v2::Args {
            events_ttl: OptionUpdate::SetToNone,
            ..Default::default()
        },
    );

    for _ in 0..3 {
        client::group::happy_path::send_text_message(env, &user, group_id, None, random_string(), None);
    }

    client::group::update_group_v2(
        env,
        user.principal,
        group_id.into(),
        &group_canister::update_group_v2::Args {
            events_ttl: OptionUpdate::SetToSome(1000),
            ..Default::default()
        },
    );

    for _ in 0..3 {
        client::group::happy_path::send_text_message(env, &user, group_id, None, random_string(), None);
    }

    let send_message_response2 =
        client::group::happy_path::send_text_message(env, &user, group_id, None, random_string(), None);

    env.advance_time(Duration::from_millis(2000));
    env.tick();

    let expected_expired_event_ranges = vec![
        (
            send_message_response1.event_index,
            EventIndex::from(u32::from(send_message_response1.event_index) + 3),
        ),
        (
            EventIndex::from(u32::from(send_message_response1.event_index) + 5),
            EventIndex::from(u32::from(send_message_response1.event_index) + 7),
        ),
        (
            EventIndex::from(u32::from(send_message_response1.event_index) + 13),
            EventIndex::from(u32::from(send_message_response1.event_index) + 16),
        ),
    ];
    let expected_expired_message_ranges = vec![
        (
            send_message_response1.message_index,
            MessageIndex::from(u32::from(send_message_response1.message_index) + 6),
        ),
        (
            MessageIndex::from(u32::from(send_message_response1.message_index) + 10),
            MessageIndex::from(u32::from(send_message_response1.message_index) + 13),
        ),
    ];

    let events_response1 = client::group::happy_path::events(env, &user, group_id, EventIndex::default(), true, 50, 50);
    assert!(!events_response1.events.is_empty());
    assert_eq!(events_response1.expired_event_ranges, expected_expired_event_ranges);
    assert_eq!(events_response1.expired_message_ranges, expected_expired_message_ranges);

    let events_response2 =
        client::group::happy_path::events(env, &user, group_id, send_message_response2.event_index, false, 50, 50);
    assert!(!events_response2.events.is_empty());
    assert_eq!(events_response2.expired_event_ranges, expected_expired_event_ranges);
    assert_eq!(events_response2.expired_message_ranges, expected_expired_message_ranges);
}

#[test]
fn stable_memory_garbage_collected_after_messages_disappear() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), false, true);

    client::group::update_group_v2(
        env,
        user.principal,
        group_id.into(),
        &group_canister::update_group_v2::Args {
            events_ttl: OptionUpdate::SetToSome(1000),
            ..Default::default()
        },
    );

    for _ in 0..5 {
        let result = client::group::happy_path::send_text_message(env, &user, group_id, None, random_string(), None);

        for _ in 0..5 {
            client::group::happy_path::send_text_message(
                env,
                &user,
                group_id,
                Some(result.message_index),
                random_string(),
                None,
            );
        }
    }

    assert_eq!(count_stable_memory_event_keys(env, group_id, CHAT_EVENTS_MEMORY_ID), 32);

    // Tick once to expire the messages
    env.advance_time(Duration::from_secs(2));
    env.tick();

    // Tick again to garbage collect stable memory
    env.advance_time(Duration::from_secs(60));
    env.tick();

    assert_eq!(count_stable_memory_event_keys(env, group_id, CHAT_EVENTS_MEMORY_ID), 2);
}
