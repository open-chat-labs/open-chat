use crate::env::ENV;
use crate::rng::{random_message_id, random_string};
use crate::{client, TestEnv};
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use types::{ChatEvent, MessageContent};
use utils::time::MINUTE_IN_MS;

#[test]
fn delete_direct_message_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::user_index::happy_path::register_user(env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(env, canister_ids.user_index);

    let message_id = random_message_id();

    let send_message_response =
        client::user::happy_path::send_text_message(env, &user1, user2.user_id, "TEXT", Some(message_id));

    let delete_messages_response = client::user::delete_messages(
        env,
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
        client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![send_message_response.event_index]);
    if let Some(ChatEvent::Message(m)) = user1_events_response.events.first().map(|e| &e.event) {
        assert!(matches!(m.content, MessageContent::Deleted(_)));
    } else {
        panic!("Unexpected response from `events_by_index`: {user1_events_response:?}");
    }

    let user2_events_response =
        client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![send_message_response.event_index]);
    if let Some(ChatEvent::Message(m)) = user2_events_response.events.first().map(|e| &e.event) {
        assert!(matches!(m.content, MessageContent::Deleted(_)));
    } else {
        panic!("Unexpected response from `events_by_index`: {user2_events_response:?}");
    }
}

#[test]
fn delete_their_direct_message_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::user_index::happy_path::register_user(env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(env, canister_ids.user_index);

    let message_id = random_message_id();

    let send_message_response =
        client::user::happy_path::send_text_message(env, &user1, user2.user_id, "TEXT", Some(message_id));

    let delete_messages_response = client::user::delete_messages(
        env,
        user2.principal,
        user2.canister(),
        &user_canister::delete_messages::Args {
            user_id: user1.user_id,
            thread_root_message_index: None,
            message_ids: vec![message_id],
            correlation_id: 0,
        },
    );
    assert!(matches!(
        delete_messages_response,
        user_canister::delete_messages::Response::Success
    ));

    // The message should only be deleted for user2
    let user1_events_response =
        client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![send_message_response.event_index]);
    if let Some(ChatEvent::Message(m)) = user1_events_response.events.first().map(|e| &e.event) {
        assert!(matches!(m.content, MessageContent::Text(_)));
    } else {
        panic!("Unexpected response from `events_by_index`: {user1_events_response:?}");
    }

    let user2_events_response =
        client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![send_message_response.event_index]);
    if let Some(ChatEvent::Message(m)) = user2_events_response.events.first().map(|e| &e.event) {
        assert!(matches!(m.content, MessageContent::Deleted(_)));
    } else {
        panic!("Unexpected response from `events_by_index`: {user2_events_response:?}");
    }
}

#[test]
fn delete_group_message_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::user_index::happy_path::register_user(env, canister_ids.user_index);
    let group = client::user::happy_path::create_group(env, &user, &random_string(), false, false);

    let message_id = random_message_id();

    let send_message_response = client::group::happy_path::send_text_message(env, &user, group, None, "TEXT", Some(message_id));

    let delete_messages_response = client::group::delete_messages(
        env,
        user.principal,
        group.into(),
        &group_canister::delete_messages::Args {
            thread_root_message_index: None,
            message_ids: vec![message_id],
            as_platform_moderator: None,
            correlation_id: 0,
        },
    );
    assert!(matches!(
        delete_messages_response,
        group_canister::delete_messages::Response::Success
    ));

    let events_response =
        client::group::happy_path::events_by_index(env, &user, group, vec![send_message_response.event_index]);
    if let Some(ChatEvent::Message(m)) = events_response.events.first().map(|e| &e.event) {
        assert!(matches!(m.content, MessageContent::Deleted(_)));
    } else {
        panic!("Unexpected response from `events_by_index`: {events_response:?}");
    }
}

#[test_case(false; "with_no_delay")]
#[test_case(true; "with_delay")]
fn delete_then_undelete_direct_message(delay: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::user_index::happy_path::register_user(env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(env, canister_ids.user_index);

    let message_id = random_message_id();

    let send_message_response =
        client::user::happy_path::send_text_message(env, &user1, user2.user_id, "TEXT", Some(message_id));

    let delete_messages_response = client::user::delete_messages(
        env,
        user1.principal,
        user1.user_id.into(),
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

    if delay {
        env.advance_time(Duration::from_millis(5 * MINUTE_IN_MS));
        env.tick();
    }

    let undelete_messages_response = client::user::undelete_messages(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::undelete_messages::Args {
            user_id: user2.user_id,
            thread_root_message_index: None,
            message_ids: vec![message_id],
            correlation_id: 0,
        },
    );
    if let user_canister::undelete_messages::Response::Success(result) = undelete_messages_response {
        assert_eq!(result.messages.len(), if delay { 0 } else { 1 });
    } else {
        panic!("Unexpected response from `undelete_messages`: {undelete_messages_response:?}");
    }

    let events_response1 =
        client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![send_message_response.event_index]);
    if let Some(ChatEvent::Message(m)) = events_response1.events.first().map(|e| &e.event) {
        if delay {
            assert!(matches!(m.content, MessageContent::Deleted(_)));
        } else {
            assert!(matches!(m.content, MessageContent::Text(_)));
        }
    } else {
        panic!("Unexpected response from `events_by_index`: {events_response1:?}");
    }

    let events_response2 =
        client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![send_message_response.event_index]);
    if let Some(ChatEvent::Message(m)) = events_response2.events.first().map(|e| &e.event) {
        if delay {
            assert!(matches!(m.content, MessageContent::Deleted(_)));
        } else {
            assert!(matches!(m.content, MessageContent::Text(_)));
        }
    } else {
        panic!("Unexpected response from `events_by_index`: {events_response2:?}");
    }
}

#[test_case(false; "with_no_delay")]
#[test_case(true; "with_delay")]
fn delete_then_undelete_group_message(delay: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::user_index::happy_path::register_user(env, canister_ids.user_index);
    let group = client::user::happy_path::create_group(env, &user, &random_string(), false, false);

    let message_id = random_message_id();

    let send_message_response = client::group::happy_path::send_text_message(env, &user, group, None, "TEXT", Some(message_id));

    let delete_messages_response = client::group::delete_messages(
        env,
        user.principal,
        group.into(),
        &group_canister::delete_messages::Args {
            thread_root_message_index: None,
            message_ids: vec![message_id],
            as_platform_moderator: None,
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
        env,
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
        client::group::happy_path::events_by_index(env, &user, group, vec![send_message_response.event_index]);
    if let Some(ChatEvent::Message(m)) = events_response.events.first().map(|e| &e.event) {
        if delay {
            assert!(matches!(m.content, MessageContent::Deleted(_)));
        } else {
            assert!(matches!(m.content, MessageContent::Text(_)));
        }
    } else {
        panic!("Unexpected response from `events_by_index`: {events_response:?}");
    }
}

#[test_case(true; "is_platform_moderator")]
#[test_case(false; "is_not_platform_moderator")]
fn platform_operators_can_delete_messages(is_platform_moderator: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user1 = client::user_index::happy_path::register_user(env, canister_ids.user_index);
    let user2 = client::user_index::happy_path::register_user(env, canister_ids.user_index);
    let group = client::user::happy_path::create_group(env, &user1, &random_string(), true, true);
    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group);

    let message_id = random_message_id();

    client::group::happy_path::send_text_message(env, &user1, group, None, "TEXT", Some(message_id));

    if is_platform_moderator {
        client::user_index::add_platform_moderator(
            env,
            *controller,
            canister_ids.user_index,
            &user_index_canister::add_platform_moderator::Args { user_id: user2.user_id },
        );
    }

    let delete_messages_response = client::group::delete_messages(
        env,
        user2.principal,
        group.into(),
        &group_canister::delete_messages::Args {
            thread_root_message_index: None,
            message_ids: vec![message_id],
            as_platform_moderator: Some(true),
            correlation_id: 0,
        },
    );
    if is_platform_moderator {
        assert!(matches!(
            delete_messages_response,
            group_canister::delete_messages::Response::Success
        ));
    } else {
        assert!(matches!(
            delete_messages_response,
            group_canister::delete_messages::Response::NotPlatformModerator
        ));
    }
}
