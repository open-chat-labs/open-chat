use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::rng::random_message_id;
use crate::{client, TestEnv};
use std::ops::Deref;
use std::time::Duration;
use types::{ChatEvent, EventIndex, MessageContent, TextContent};

#[test]
fn send_message_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::user_index::happy_path::register_user(env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(env, canister_ids.user_index);

    let send_message_result = client::user::happy_path::send_text_message(env, &user1, user2.user_id, "TEXT", None);

    let events_response1 =
        client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![send_message_result.event_index]);
    let events_response2 =
        client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![send_message_result.event_index]);

    assert_eq!(events_response1.events.len(), 1);
    assert!(matches!(events_response1.events[0].event, ChatEvent::Message(_)));
    assert_eq!(events_response2.events.len(), 1);
    assert!(matches!(events_response2.events[0].event, ChatEvent::Message(_)));
}

#[test]
fn empty_message_fails() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::user_index::happy_path::register_user(env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(env, canister_ids.user_index);

    let send_message_args = user_canister::send_message::Args {
        recipient: user2.user_id,
        thread_root_message_index: None,
        message_id: random_message_id(),
        sender_name: user1.username(),
        content: MessageContent::Text(TextContent { text: String::default() }),
        replies_to: None,
        forwarding: false,
        correlation_id: 0,
    };
    let response = client::user::send_message(env, user1.principal, user1.canister(), &send_message_args);
    if !matches!(response, user_canister::send_message::Response::MessageEmpty) {
        panic!("SendMessage was expected to return MessageEmpty but did not: {response:?}");
    }
}

#[test]
fn text_too_long_fails() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::user_index::happy_path::register_user(env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(env, canister_ids.user_index);

    let send_message_args = user_canister::send_message::Args {
        recipient: user2.user_id,
        thread_root_message_index: None,
        message_id: random_message_id(),
        sender_name: user1.username(),
        content: MessageContent::Text(TextContent {
            text: (0..5001).map(|_| '1').collect(),
        }),
        replies_to: None,
        forwarding: false,
        correlation_id: 0,
    };
    let response = client::user::send_message(env, user1.principal, user1.canister(), &send_message_args);
    if !matches!(response, user_canister::send_message::Response::TextTooLong(5000)) {
        panic!("SendMessage was expected to return TextTooLong(5000) but did not: {response:?}");
    }
}

#[test]
fn send_message_retries_if_fails() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::user_index::happy_path::register_user(env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(env, canister_ids.user_index);

    stop_canister(env, canister_ids.local_user_index, user2.user_id.into());

    let send_message_result = client::user::happy_path::send_text_message(env, &user1, user2.user_id, "TEXT", None);
    env.tick();

    start_canister(env, canister_ids.local_user_index, user2.user_id.into());

    env.advance_time(Duration::from_secs(10));
    env.tick();

    let events_response =
        client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![send_message_result.event_index]);

    assert_eq!(events_response.events.len(), 1);
    assert!(matches!(events_response.events[0].event, ChatEvent::Message(_)));
}

#[test]
fn messages_arrive_in_order_even_if_some_fail_originally() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::user_index::happy_path::register_user(env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(env, canister_ids.user_index);

    stop_canister(env, canister_ids.local_user_index, user2.user_id.into());

    client::user::happy_path::send_text_message(env, &user1, user2.user_id, "1", None);
    client::user::happy_path::send_text_message(env, &user1, user2.user_id, "2", None);

    start_canister(env, canister_ids.local_user_index, user2.user_id.into());

    client::user::happy_path::send_text_message(env, &user1, user2.user_id, "3", None);

    let events_response = client::user::happy_path::events(env, &user2, user1.user_id, EventIndex::default(), true, 100, 100);

    let first = &events_response.events[events_response.events.len() - 3].event;
    let second = &events_response.events[events_response.events.len() - 2].event;
    let third = &events_response.events[events_response.events.len() - 1].event;

    validate_event_is_message_with_text(first, "1");
    validate_event_is_message_with_text(second, "2");
    validate_event_is_message_with_text(third, "3");
}

fn validate_event_is_message_with_text(event: &ChatEvent, text: &str) {
    if let ChatEvent::Message(m) = &event {
        if let MessageContent::Text(t) = &m.content {
            if t.text == text {
                return;
            }
        }
    }
    panic!("Event does not match. {event:?}. {text}");
}
