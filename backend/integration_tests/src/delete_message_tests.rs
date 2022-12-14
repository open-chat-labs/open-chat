use crate::client;
use crate::rng::{random_message_id, random_string};
use crate::setup::{return_env, setup_env, TestEnv};
use std::time::Duration;
use test_case::test_case;
use types::{ChatEvent, MessageContent};
use utils::time::MINUTE_IN_MS;

#[test]
fn delete_direct_message_succeeds() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let user1 = client::user_index::happy_path::register_user(&mut env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(&mut env, canister_ids.user_index);

    let message_id = random_message_id();

    let send_message_response =
        client::user::happy_path::send_text_message(&mut env, &user1, user2.user_id, "TEXT", Some(message_id));

    let delete_messages_response = client::user::delete_messages(
        &mut env,
        user1.principal,
        user1.canister(),
        &user_canister::delete_messages::Args {
            user_id: user2.user_id,
            thread_root_message_index: None,
            message_ids: vec![message_id],
            correlation_id: 0,
        },
    );
    assert!(matches!(
        delete_messages_response,
        user_canister::delete_messages::Response::Success
    ));

    let user1_events_response =
        client::user::happy_path::events_by_index(&env, &user1, user2.user_id, vec![send_message_response.event_index]);
    if let Some(ChatEvent::Message(m)) = user1_events_response.events.first().map(|e| &e.event) {
        assert!(matches!(m.content, MessageContent::Deleted(_)));
    } else {
        panic!("Unexpected response from `events_by_index`: {user1_events_response:?}");
    }

    let user2_events_response =
        client::user::happy_path::events_by_index(&env, &user2, user1.user_id, vec![send_message_response.event_index]);
    if let Some(ChatEvent::Message(m)) = user2_events_response.events.first().map(|e| &e.event) {
        assert!(matches!(m.content, MessageContent::Deleted(_)));
    } else {
        panic!("Unexpected response from `events_by_index`: {user2_events_response:?}");
    }

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}

#[test]
fn delete_group_message_succeeds() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let user = client::user_index::happy_path::register_user(&mut env, canister_ids.user_index);
    let group = client::user::happy_path::create_group(&mut env, &user, &random_string(), true, true);

    let message_id = random_message_id();

    let send_message_response = client::group::happy_path::send_text_message(&mut env, &user, group, "TEXT", Some(message_id));

    let delete_messages_response = client::group::delete_messages(
        &mut env,
        user.principal,
        group.into(),
        &group_canister::delete_messages::Args {
            thread_root_message_index: None,
            message_ids: vec![message_id],
            correlation_id: 0,
        },
    );
    assert!(matches!(
        delete_messages_response,
        group_canister::delete_messages::Response::Success
    ));

    let events_response =
        client::group::happy_path::events_by_index(&env, &user, group, vec![send_message_response.event_index]);
    if let Some(ChatEvent::Message(m)) = events_response.events.first().map(|e| &e.event) {
        assert!(matches!(m.content, MessageContent::Deleted(_)));
    } else {
        panic!("Unexpected response from `events_by_index`: {events_response:?}");
    }

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}

#[test_case(false; "with_no_delay")]
#[test_case(true; "with_delay")]
fn delete_then_undelete_group_message(delay: bool) {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let user = client::user_index::happy_path::register_user(&mut env, canister_ids.user_index);
    let group = client::user::happy_path::create_group(&mut env, &user, &random_string(), true, true);

    let message_id = random_message_id();

    let send_message_response = client::group::happy_path::send_text_message(&mut env, &user, group, "TEXT", Some(message_id));

    let delete_messages_response = client::group::delete_messages(
        &mut env,
        user.principal,
        group.into(),
        &group_canister::delete_messages::Args {
            thread_root_message_index: None,
            message_ids: vec![message_id],
            correlation_id: 0,
        },
    );
    assert!(matches!(
        delete_messages_response,
        group_canister::delete_messages::Response::Success
    ));

    if delay {
        env.advance_time(Duration::from_millis(5 * MINUTE_IN_MS));
        env.tick();
    }

    let undelete_messages_response = client::group::undelete_messages(
        &mut env,
        user.principal,
        group.into(),
        &group_canister::undelete_messages::Args {
            thread_root_message_index: None,
            message_ids: vec![message_id],
            correlation_id: 0,
        },
    );
    if let group_canister::undelete_messages::Response::Success(result) = undelete_messages_response {
        assert_eq!(result.messages.len(), if delay { 0 } else { 1 });
    } else {
        panic!("Unexpected response from `undelete_messages`: {undelete_messages_response:?}");
    }

    let events_response =
        client::group::happy_path::events_by_index(&env, &user, group, vec![send_message_response.event_index]);
    if let Some(ChatEvent::Message(m)) = events_response.events.first().map(|e| &e.event) {
        if delay {
            assert!(matches!(m.content, MessageContent::Deleted(_)));
        } else {
            assert!(matches!(m.content, MessageContent::Text(_)));
        }
    } else {
        panic!("Unexpected response from `events_by_index`: {events_response:?}");
    }

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}
