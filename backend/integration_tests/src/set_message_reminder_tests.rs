use crate::env::ENV;
use crate::rng::random_string;
use crate::utils::now_millis;
use crate::{client, TestEnv};
use std::ops::Deref;
use std::time::Duration;
use types::{Chat, ChatEvent, EventIndex, MessageContent};
use utils::consts::OPENCHAT_BOT_USER_ID;

#[test]
fn set_message_reminder_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let now = now_millis(env);
    let notes = random_string();

    let starting_index =
        client::user::happy_path::events(env, &user1, OPENCHAT_BOT_USER_ID, EventIndex::default(), true, 1000, 1000)
            .events
            .last()
            .unwrap()
            .index
            .incr();

    client::user::set_message_reminder_v2(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::set_message_reminder_v2::Args {
            chat: Chat::Direct(user2.user_id.into()),
            thread_root_message_index: None,
            event_index: 10.into(),
            notes: Some(notes.clone()),
            remind_at: now + 1000,
        },
    );

    env.advance_time(Duration::from_millis(999));
    env.tick();

    let events_response1 =
        client::user::happy_path::events(env, &user1, OPENCHAT_BOT_USER_ID, starting_index, true, 1000, 1000).events;

    assert_eq!(events_response1.len(), 1);

    env.advance_time(Duration::from_millis(1));
    env.tick();

    let latest_bot_messages_response =
        client::user::happy_path::events(env, &user1, OPENCHAT_BOT_USER_ID, starting_index, true, 1000, 1000);

    assert_eq!(latest_bot_messages_response.events.len(), 2);

    let mut iter = latest_bot_messages_response.events.into_iter();
    let reminder_created_event = iter.next().unwrap();
    let reminder_event = iter.next().unwrap();

    if let ChatEvent::Message(m) = reminder_created_event.event {
        if let MessageContent::MessageReminderCreated(r) = m.content {
            assert_eq!(r.notes, Some(notes.clone()));
            assert!(r.hidden);
        } else {
            panic!()
        }
    } else {
        panic!()
    }

    if let ChatEvent::Message(m) = reminder_event.event {
        if let MessageContent::MessageReminder(r) = m.content {
            assert_eq!(r.notes, Some(notes));
        } else {
            panic!()
        }
        let replies_to = m.replies_to.unwrap();
        assert_eq!(replies_to.chat_if_other, Some((Chat::Direct(user2.user_id.into()), None)));
        assert_eq!(replies_to.event_index, 10.into());
    } else {
        panic!()
    }
}

#[test]
fn cancel_message_reminder_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let now = now_millis(env);

    let set_message_reminder_response = client::user::set_message_reminder_v2(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::set_message_reminder_v2::Args {
            chat: Chat::Direct(user2.user_id.into()),
            thread_root_message_index: None,
            event_index: 10.into(),
            notes: None,
            remind_at: now + 1000,
        },
    );
    let reminder_id = if let user_canister::set_message_reminder_v2::Response::Success(id) = set_message_reminder_response {
        id
    } else {
        panic!()
    };

    client::user::cancel_message_reminder(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::cancel_message_reminder::Args { reminder_id },
    );

    let latest_bot_message_index =
        client::user::happy_path::events(env, &user1, OPENCHAT_BOT_USER_ID, EventIndex::default(), true, 1000, 1000)
            .events
            .last()
            .unwrap()
            .index;

    env.advance_time(Duration::from_millis(1000));
    env.tick();

    let events =
        client::user::happy_path::events(env, &user1, OPENCHAT_BOT_USER_ID, latest_bot_message_index, true, 1000, 1000).events;

    assert_eq!(events.len(), 1);

    if let ChatEvent::Message(m) = &events[0].event {
        if let MessageContent::MessageReminderCreated(r) = &m.content {
            assert!(r.hidden);
        } else {
            panic!()
        }
    } else {
        panic!()
    }
}
