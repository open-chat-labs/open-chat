use crate::env::ENV;
use crate::rng::random_string;
use crate::utils::now_millis;
use crate::{client, TestEnv};
use std::ops::Deref;
use std::time::Duration;
use types::{ChatEvent, EventIndex, MessageContent};
use utils::consts::OPENCHAT_BOT_USER_ID;

#[test]
fn set_message_reminder_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::user_index::happy_path::register_user(env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(env, canister_ids.user_index);

    let now = now_millis(env);
    let notes = random_string();

    client::user::set_message_reminder(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::set_message_reminder::Args {
            chat_id: user2.user_id.into(),
            thread_root_message_index: None,
            event_index: 10.into(),
            notes: Some(notes.clone()),
            remind_at: now + 1000,
        },
    );

    let latest_bot_message_index =
        client::user::happy_path::events(env, &user1, OPENCHAT_BOT_USER_ID, EventIndex::default(), true, 1000, 1000)
            .events
            .last()
            .unwrap()
            .index;

    env.advance_time(Duration::from_millis(999));
    env.tick();

    assert!(
        client::user::happy_path::events(env, &user1, OPENCHAT_BOT_USER_ID, latest_bot_message_index.incr(), true, 1, 1)
            .events
            .is_empty()
    );

    env.advance_time(Duration::from_millis(1));
    env.tick();

    let latest_bot_message_response =
        client::user::happy_path::events(env, &user1, OPENCHAT_BOT_USER_ID, latest_bot_message_index.incr(), true, 1, 1);

    assert!(!latest_bot_message_response.events.is_empty());

    let latest_bot_message = latest_bot_message_response.events.into_iter().next().unwrap();

    if let ChatEvent::Message(m) = latest_bot_message.event {
        if let MessageContent::MessageReminder(r) = m.content {
            assert_eq!(r.chat_id, user2.user_id.into());
            assert_eq!(r.thread_root_message_index, None);
            assert_eq!(r.event_index, 10.into());
            assert_eq!(r.notes, Some(notes));
        } else {
            panic!()
        }
        let replies_to = m.replies_to.unwrap();
        assert_eq!(replies_to.chat_id_if_other, Some(user2.user_id.into()));
        assert_eq!(replies_to.event_index, 10.into());
    } else {
        panic!()
    }
}

#[test]
fn setting_message_reminder_again_clears_original_reminder() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::user_index::happy_path::register_user(env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(env, canister_ids.user_index);

    let now = now_millis(env);

    client::user::set_message_reminder(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::set_message_reminder::Args {
            chat_id: user2.user_id.into(),
            thread_root_message_index: None,
            event_index: 10.into(),
            notes: None,
            remind_at: now + 1000,
        },
    );

    client::user::set_message_reminder(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::set_message_reminder::Args {
            chat_id: user2.user_id.into(),
            thread_root_message_index: None,
            event_index: 10.into(),
            notes: None,
            remind_at: now + 2000,
        },
    );

    let latest_bot_message_index =
        client::user::happy_path::events(env, &user1, OPENCHAT_BOT_USER_ID, EventIndex::default(), true, 1000, 1000)
            .events
            .last()
            .unwrap()
            .index;

    env.advance_time(Duration::from_millis(1999));
    env.tick();

    assert!(
        client::user::happy_path::events(env, &user1, OPENCHAT_BOT_USER_ID, latest_bot_message_index.incr(), true, 1, 1)
            .events
            .is_empty()
    );

    env.advance_time(Duration::from_millis(1));
    env.tick();

    assert!(
        !client::user::happy_path::events(env, &user1, OPENCHAT_BOT_USER_ID, latest_bot_message_index.incr(), true, 1, 1)
            .events
            .is_empty()
    );
}

#[test]
fn clear_message_reminder_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::user_index::happy_path::register_user(env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(env, canister_ids.user_index);

    let now = now_millis(env);

    client::user::set_message_reminder(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::set_message_reminder::Args {
            chat_id: user2.user_id.into(),
            thread_root_message_index: None,
            event_index: 10.into(),
            notes: None,
            remind_at: now + 1000,
        },
    );

    client::user::clear_message_reminder(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::clear_message_reminder::Args {
            chat_id: user2.user_id.into(),
            thread_root_message_index: None,
            event_index: 10.into(),
        },
    );

    let latest_bot_message_index =
        client::user::happy_path::events(env, &user1, OPENCHAT_BOT_USER_ID, EventIndex::default(), true, 1000, 1000)
            .events
            .last()
            .unwrap()
            .index;

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    assert!(
        client::user::happy_path::events(env, &user1, OPENCHAT_BOT_USER_ID, latest_bot_message_index.incr(), true, 1, 1)
            .events
            .is_empty()
    );
}
