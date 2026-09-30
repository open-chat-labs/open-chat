use crate::env::ENV;
use crate::utils::tick_many;
use crate::{TestEnv, User, client};
use constants::MINUTE_IN_MS;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_from_u128, random_string};
use types::{
    BlobReference, ChatEvent, ChatId, EventIndex, FileContent, MessageContent, MessageContentInitial, MessageId, MessageIndex,
    UserId,
};

#[test]
fn delete_direct_message_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    let message_id = random_from_u128();

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

    // The message and then its deletion have to reach user2's canister
    wait_for_message(env, &user2, user1.user_id, None, message_id, is_deleted);
}

#[test]
fn file_deleted_after_direct_message_deleted() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    let message_id = random_from_u128();

    let blob_reference = client::storage_index::happy_path::upload_file(
        env,
        user1.principal,
        canister_ids.storage_index,
        100,
        vec![user1.canister()],
    );

    client::user::send_message_v2(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::File(FileContent {
                name: random_string(),
                caption: None,
                mime_type: random_string(),
                file_size: 100,
                blob_reference: Some(blob_reference.clone()),
            }),
            replies_to: None,
            forwarding: false,
            block_level_markdown: false,
            message_filter_failed: None,
            pin: None,
            og_previews: Vec::new(),
        },
    );

    assert!(client::storage_bucket::happy_path::file_exists(
        env,
        user1.principal,
        blob_reference.canister_id,
        blob_reference.blob_id
    ));

    let delete_messages_response = client::user::delete_messages(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::delete_messages::Args {
            user_id: user2.user_id,
            thread_root_message_index: None,
            message_ids: vec![message_id],
        },
    );
    assert!(matches!(
        delete_messages_response,
        user_canister::delete_messages::Response::Success
    ));

    env.advance_time(Duration::from_secs(300));
    wait_for_file_to_be_deleted(env, &user1, &blob_reference);
}

#[test]
fn delete_thread_reply_in_direct_chat_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    let root = client::user::happy_path::send_text_message(env, &user1, user2.user_id, "ROOT", None);

    let blob_reference = client::storage_index::happy_path::upload_file(
        env,
        user1.principal,
        canister_ids.storage_index,
        100,
        vec![user1.canister()],
    );

    let message_id = random_from_u128();
    client::user::happy_path::send_message(
        env,
        &user1,
        user2.user_id,
        Some(root.message_index),
        MessageContentInitial::File(FileContent {
            name: random_string(),
            caption: None,
            mime_type: random_string(),
            file_size: 100,
            blob_reference: Some(blob_reference.clone()),
        }),
        None,
        Some(message_id),
    );

    // Let the reply reach user2's canister before it is deleted
    wait_for_message(env, &user2, user1.user_id, Some(root.message_index), message_id, is_file);

    let delete_messages_response = client::user::delete_messages(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::delete_messages::Args {
            user_id: user2.user_id,
            thread_root_message_index: Some(root.message_index),
            message_ids: vec![message_id],
        },
    );
    assert!(
        matches!(delete_messages_response, user_canister::delete_messages::Response::Success),
        "{delete_messages_response:?}"
    );

    let message = client::user::happy_path::thread_message(env, &user1, user2.user_id, root.message_index, message_id);
    assert!(matches!(message.content, MessageContent::Deleted(_)));

    // The deletion has to reach user2's canister
    wait_for_message(env, &user2, user1.user_id, Some(root.message_index), message_id, is_deleted);

    // The root message must be unaffected
    let root_events = client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![root.event_index]);
    let Some(ChatEvent::Message(root_message)) = root_events.events.first().map(|e| &e.event) else {
        panic!("Unexpected response from `events_by_index`: {root_events:?}");
    };
    assert_eq!(root_message.content.text().unwrap(), "ROOT");

    assert!(client::storage_bucket::happy_path::file_exists(
        env,
        user1.principal,
        blob_reference.canister_id,
        blob_reference.blob_id
    ));

    env.advance_time(Duration::from_secs(300));

    // The deleted content is hard deleted, which removes the file
    wait_for_file_to_be_deleted(env, &user1, &blob_reference);
}

#[test]
fn delete_their_direct_message_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    let message_id = random_from_u128();

    let send_message_response =
        client::user::happy_path::send_text_message(env, &user1, user2.user_id, "TEXT", Some(message_id));

    // user2 can't delete the message until it has reached their canister
    wait_for_message(env, &user2, user1.user_id, None, message_id, is_text);

    let delete_messages_response = client::user::delete_messages(
        env,
        user2.principal,
        user2.canister(),
        &user_canister::delete_messages::Args {
            user_id: user1.user_id,
            thread_root_message_index: None,
            message_ids: vec![message_id],
        },
    );
    assert!(matches!(
        delete_messages_response,
        user_canister::delete_messages::Response::Success
    ));

    // Long enough for the deletion to have reached user1's canister, had it been sent there
    tick_many(env, 10);

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

    let user = client::register_user(env, canister_ids);
    let group = client::user::happy_path::create_group(env, &user, &random_string(), false, false);

    let message_id = random_from_u128();

    let send_message_response = client::group::happy_path::send_text_message(env, &user, group, None, "TEXT", Some(message_id));

    let delete_messages_response = client::group::delete_messages(
        env,
        user.principal,
        group.into(),
        &group_canister::delete_messages::Args {
            thread_root_message_index: None,
            message_ids: vec![message_id],
            as_platform_moderator: None,
            new_achievement: false,
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

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    let message_id = random_from_u128();

    let send_message_response =
        client::user::happy_path::send_text_message(env, &user1, user2.user_id, "TEXT", Some(message_id));

    let delete_messages_response = client::user::delete_messages(
        env,
        user1.principal,
        user1.user_id.canister_id(),
        &user_canister::delete_messages::Args {
            user_id: user2.user_id,
            thread_root_message_index: None,
            message_ids: vec![message_id],
        },
    );
    assert!(matches!(
        delete_messages_response,
        user_canister::delete_messages::Response::Success
    ));

    // The message and then its deletion have to reach user2's canister
    wait_for_message(env, &user2, user1.user_id, None, message_id, is_deleted);

    if delay {
        env.advance_time(Duration::from_millis(5 * MINUTE_IN_MS));
        wait_for_direct_message_content_to_be_removed(env, &user1, user2.user_id, message_id);
    }

    let undelete_messages_response = client::user::undelete_messages(
        env,
        user1.principal,
        user1.user_id.canister_id(),
        &user_canister::undelete_messages::Args {
            user_id: user2.user_id,
            thread_root_message_index: None,
            message_ids: vec![message_id],
        },
    );
    if let user_canister::undelete_messages::Response::Success(result) = undelete_messages_response {
        assert_eq!(result.messages.len(), if delay { 0 } else { 1 });
    } else {
        panic!("Unexpected response from `undelete_messages`: {undelete_messages_response:?}");
    }

    if delay {
        // Nothing was undeleted, so this is long enough for an undeletion to have reached user2's
        // canister, had one been sent there
        tick_many(env, 10);
    } else {
        wait_for_message(env, &user2, user1.user_id, None, message_id, is_text);
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

#[test]
fn deleting_an_undeleted_direct_message_again_gives_a_full_undelete_window() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    let message_id = random_from_u128();
    let send_message_response =
        client::user::happy_path::send_text_message(env, &user1, user2.user_id, "TEXT", Some(message_id));

    // Each waits for user2's canister to catch up, so that the message is deleted and undeleted there
    // at the same times as in user1's canister
    let delete = |env: &mut PocketIc| {
        let response = client::user::delete_messages(
            env,
            user1.principal,
            user1.user_id.canister_id(),
            &user_canister::delete_messages::Args {
                user_id: user2.user_id,
                thread_root_message_index: None,
                message_ids: vec![message_id],
            },
        );
        assert!(matches!(response, user_canister::delete_messages::Response::Success));
        wait_for_message(env, &user2, user1.user_id, None, message_id, is_deleted);
    };
    let undelete = |env: &mut PocketIc| {
        let response = client::user::undelete_messages(
            env,
            user1.principal,
            user1.user_id.canister_id(),
            &user_canister::undelete_messages::Args {
                user_id: user2.user_id,
                thread_root_message_index: None,
                message_ids: vec![message_id],
            },
        );
        match response {
            user_canister::undelete_messages::Response::Success(result) => assert_eq!(result.messages.len(), 1),
            response => panic!("Unexpected response from `undelete_messages`: {response:?}"),
        }
        wait_for_message(env, &user2, user1.user_id, None, message_id, is_text);
    };

    delete(env);
    undelete(env);

    // The job queued by the first deletion is cancelled by the undelete, so it doesn't remove the
    // content of the message deleted again, which can still be undeleted for the full 5 minutes
    env.advance_time(Duration::from_millis(3 * MINUTE_IN_MS));
    delete(env);
    env.advance_time(Duration::from_millis(3 * MINUTE_IN_MS));
    // Long enough for the first deletion's job, which would now be due, to have run had it not been
    // cancelled
    tick_many(env, 3);
    undelete(env);

    for (user, them) in [(&user1, user2.user_id), (&user2, user1.user_id)] {
        let events_response =
            client::user::happy_path::events_by_index(env, user, them, vec![send_message_response.event_index]);
        let Some(ChatEvent::Message(m)) = events_response.events.first().map(|e| &e.event) else {
            panic!("Unexpected response from `events_by_index`: {events_response:?}");
        };
        assert!(matches!(m.content, MessageContent::Text(_)), "{:?}", m.content);
    }
}

#[test_case(false; "with_no_delay")]
#[test_case(true; "with_delay")]
fn delete_then_undelete_group_message(delay: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let group = client::user::happy_path::create_group(env, &user, &random_string(), false, false);

    let message_id = random_from_u128();

    let send_message_response = client::group::happy_path::send_text_message(env, &user, group, None, "TEXT", Some(message_id));

    let delete_messages_response = client::group::delete_messages(
        env,
        user.principal,
        group.into(),
        &group_canister::delete_messages::Args {
            thread_root_message_index: None,
            message_ids: vec![message_id],
            as_platform_moderator: None,
            new_achievement: false,
        },
    );
    assert!(matches!(
        delete_messages_response,
        group_canister::delete_messages::Response::Success
    ));

    if delay {
        env.advance_time(Duration::from_millis(5 * MINUTE_IN_MS));
        wait_for_group_message_content_to_be_removed(env, &user, group, message_id);
    }

    let undelete_messages_response = client::group::undelete_messages(
        env,
        user.principal,
        group.into(),
        &group_canister::undelete_messages::Args {
            thread_root_message_index: None,
            message_ids: vec![message_id],
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
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);
    let group = client::user::happy_path::create_group(env, &user1, &random_string(), true, true);
    client::group::happy_path::join_group(env, user2.principal, group);

    let message_id = random_from_u128();

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
            new_achievement: false,
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
            group_canister::delete_messages::Response::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)
        ));
    }
}

fn is_text(content: &MessageContent) -> bool {
    matches!(content, MessageContent::Text(_))
}

fn is_file(content: &MessageContent) -> bool {
    matches!(content, MessageContent::File(_))
}

fn is_deleted(content: &MessageContent) -> bool {
    matches!(content, MessageContent::Deleted(_))
}

// Ticks until the message in the user's direct chat with `them` has reached their canister and its
// content there satisfies the predicate. This can take many rounds, since the first User canister to
// run on a subnet takes around 10 rounds to handle its first message (seemingly while the wasm is
// compiled there), a number which grows with the size of the wasm.
fn wait_for_message(
    env: &mut PocketIc,
    user: &User,
    them: UserId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    predicate: fn(&MessageContent) -> bool,
) {
    let mut content = None;
    for _ in 0..30 {
        content = message_content(env, user, them, thread_root_message_index, message_id);
        if content.as_ref().is_some_and(predicate) {
            return;
        }
        env.tick();
    }
    panic!(
        "Unexpected content of message {message_id:?} in user {}'s canister: {content:?}",
        user.user_id
    );
}

// The content of the message in the user's direct chat with `them`, if it has reached their canister
fn message_content(
    env: &PocketIc,
    user: &User,
    them: UserId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
) -> Option<MessageContent> {
    let response = client::user::events(
        env,
        user.principal,
        user.canister(),
        &user_canister::events::Args {
            user_id: user.user_id,
            them,
            thread_root_message_index,
            start_index: EventIndex::default(),
            ascending: true,
            max_messages: 100,
            max_events: 100,
            latest_known_update: None,
        },
    );

    let user_canister::events::Response::Success(result) = response else {
        return None;
    };

    result.events.into_iter().find_map(|e| match e.event {
        ChatEvent::Message(m) if m.message_id == message_id => Some(m.content),
        _ => None,
    })
}

// Ticks until the user's canister has removed the content of the message they deleted, which it does
// once the message has been deleted for 5 minutes. The job doing so runs in a call which the canister
// makes to itself when its timer fires, so it can take more than one round.
fn wait_for_direct_message_content_to_be_removed(env: &mut PocketIc, user: &User, them: UserId, message_id: MessageId) {
    for _ in 0..10 {
        let response = client::user::deleted_message(
            env,
            user.principal,
            user.canister(),
            &user_canister::deleted_message::Args {
                user_id: them,
                message_id,
            },
        );
        if matches!(
            response,
            user_canister::deleted_message::Response::Error(e) if e.matches_code(OCErrorCode::MessageHardDeleted)
        ) {
            return;
        }
        env.tick();
    }
    panic!(
        "User {}'s canister did not remove the content of message {message_id:?}",
        user.user_id
    );
}

// As above, but for a message the user deleted in a group
fn wait_for_group_message_content_to_be_removed(env: &mut PocketIc, user: &User, group_id: ChatId, message_id: MessageId) {
    for _ in 0..10 {
        let response = client::group::deleted_message(
            env,
            user.principal,
            group_id.into(),
            &group_canister::deleted_message::Args {
                thread_root_message_index: None,
                message_id,
            },
        );
        if matches!(
            response,
            group_canister::deleted_message::Response::Error(e) if e.matches_code(OCErrorCode::MessageHardDeleted)
        ) {
            return;
        }
        env.tick();
    }
    panic!("Group {group_id} did not remove the content of message {message_id:?}");
}

// Ticks until the file has been deleted from its storage bucket, which the canister of the user who
// uploaded it asks for once it has removed the content of the message
fn wait_for_file_to_be_deleted(env: &mut PocketIc, user: &User, blob_reference: &BlobReference) {
    for _ in 0..10 {
        if !client::storage_bucket::happy_path::file_exists(
            env,
            user.principal,
            blob_reference.canister_id,
            blob_reference.blob_id,
        ) {
            return;
        }
        env.tick();
    }
    panic!("File {} was not deleted", blob_reference.blob_id);
}
