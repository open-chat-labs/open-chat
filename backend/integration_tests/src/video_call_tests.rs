use crate::env::ENV;
use crate::rng::{random_message_id, random_string};
use crate::utils::tick_many;
use crate::{client, TestEnv};
use std::ops::Deref;

#[test]
fn start_then_end_video_call_in_direct_chat_succeeds() {
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
    assert!(user1_chat.video_call_in_progress.is_some());

    let user2_chat = client::user::happy_path::initial_state(env, &user2)
        .direct_chats
        .summaries
        .into_iter()
        .find(|c| c.them == user1.user_id)
        .unwrap();
    assert!(user2_chat.video_call_in_progress.is_some());

    client::user::happy_path::end_video_call(env, user1.user_id, user2.user_id, message_id);

    env.tick();

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
fn start_then_end_video_call_in_group_chat_succeeds() {
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

    env.tick();

    let summary = client::group::happy_path::summary(env, &user1, group);
    assert!(summary.video_call_in_progress.is_some());

    client::group::happy_path::end_video_call(env, group, message_id);

    env.tick();

    let summary = client::group::happy_path::summary(env, &user1, group);
    assert!(summary.video_call_in_progress.is_none());
}
