use crate::env::ENV;
use crate::rng::{random_message_id, random_string};
use crate::utils::tick_many;
use crate::{client, TestEnv};
use std::ops::Deref;
use types::{ChatEvent, MessageContent, VideoCallContent};

#[test]
fn start_join_end_video_call_in_direct_chat_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let message_id = random_message_id();

    client::user::happy_path::start_video_call(env, &user1, user2.user_id, message_id);

    tick_many(env, 3);

    let user1_chat = client::user::happy_path::initial_state(env, &user1)
        .direct_chats
        .summaries
        .into_iter()
        .find(|c| c.them == user2.user_id)
        .unwrap();
    assert_eq!(user1_chat.video_call_in_progress.unwrap().message_index, 0.into());

    let chat1_event = client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![1.into()])
        .events
        .pop()
        .unwrap()
        .event;
    assert_is_video_message(chat1_event, |v| v.participants.len() == 1);

    let user2_chat = client::user::happy_path::initial_state(env, &user2)
        .direct_chats
        .summaries
        .into_iter()
        .find(|c| c.them == user1.user_id)
        .unwrap();
    assert_eq!(user2_chat.video_call_in_progress.unwrap().message_index, 0.into());

    let chat2_event = client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![1.into()])
        .events
        .pop()
        .unwrap()
        .event;
    assert_is_video_message(chat2_event, |v| v.participants.len() == 1);

    client::user::happy_path::join_video_call(env, &user2, user1.user_id, message_id);

    env.tick();

    let chat1_event = client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![1.into()])
        .events
        .pop()
        .unwrap()
        .event;
    assert_is_video_message(chat1_event, |v| v.participants.len() == 2);

    let chat2_event = client::user::happy_path::events_by_index(env, &user2, user1.user_id, vec![1.into()])
        .events
        .pop()
        .unwrap()
        .event;
    assert_is_video_message(chat2_event, |v| v.participants.len() == 2);

    client::user::happy_path::end_video_call(env, user1.user_id, user2.user_id, message_id);
    client::user::happy_path::end_video_call(env, user2.user_id, user1.user_id, message_id);

    let user1_chat = client::user::happy_path::initial_state(env, &user1)
        .direct_chats
        .summaries
        .into_iter()
        .find(|c| c.them == user2.user_id)
        .unwrap();
    assert!(user1_chat.video_call_in_progress.is_none());

    let user2_chat = client::user::happy_path::initial_state(env, &user2)
        .direct_chats
        .summaries
        .into_iter()
        .find(|c| c.them == user1.user_id)
        .unwrap();
    assert!(user2_chat.video_call_in_progress.is_none());
}

#[test]
fn start_join_end_video_call_in_group_chat_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let group = client::user::happy_path::create_group(env, &user1, random_string().as_str(), true, true);
    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group);

    let message_id = random_message_id();

    client::group::happy_path::start_video_call(env, &user1, group, message_id);

    let summary = client::group::happy_path::summary(env, &user1, group);
    assert!(summary.video_call_in_progress.is_some());

    let event = client::group::happy_path::events_by_index(env, &user1, group, vec![2.into()])
        .events
        .pop()
        .unwrap()
        .event;
    assert_is_video_message(event, |v| v.participants.len() == 1);

    client::group::happy_path::join_video_call(env, user2.principal, group, message_id);

    let event = client::group::happy_path::events_by_index(env, &user1, group, vec![2.into()])
        .events
        .pop()
        .unwrap()
        .event;
    assert_is_video_message(event, |v| v.participants.len() == 2);

    client::group::happy_path::end_video_call(env, group, message_id);

    let summary = client::group::happy_path::summary(env, &user1, group);
    assert!(summary.video_call_in_progress.is_none());
}

fn assert_is_video_message<F: FnOnce(&VideoCallContent) -> bool>(event: ChatEvent, predicate: F) {
    if let ChatEvent::Message(m) = &event {
        if let MessageContent::VideoCall(v) = &m.content {
            if predicate(v) {
                return;
            } else {
                panic!("Event is a video call but does not satify predicate. Content: {v:?}");
            }
        }
    }
    panic!("Event is not a video call. Event: {event:?}");
}
