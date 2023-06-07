use crate::env::ENV;
use crate::rng::random_string;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use ic_test_state_machine_client::StateMachine;
use std::ops::Deref;
use types::{CommunityId, ChannelId, MessageContent, ChatEvent};

#[test]
fn send_text_in_channel() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    let result = client::community::happy_path::send_text_message(
        env,
        &user1,
        community_id,
        channel_id,
        None,
        "Hello, world!",
        None,
    );

    let events_response = client::community::happy_path::events_by_index(
        env,
        &user2,
        community_id,
        channel_id,
        vec![result.event_index]
    );

    if let ChatEvent::Message(message) = &events_response.events[0].event {
        if let MessageContent::Text(content) = &message.content {
            assert_eq!(content.text, "Hello, world!");
        } else {
            panic!("Expected a text message");
        }
    } else {
        panic!("Expected a message event");
    }
}

#[test]
fn send_crypto_in_channel() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    let result = client::community::happy_path::send_crypto_message(
        env,
        &user1,
        community_id,
        channel_id,
        None,
        "Hello, world!",
        None,
    );

    let events_response = client::community::happy_path::events_by_index(
        env,
        &user2,
        community_id,
        channel_id,
        vec![result.event_index]
    );

    if let ChatEvent::Message(message) = &events_response.events[0].event {
        if let MessageContent::Crypto(content) = &message.content {
            assert_eq!(content.text, "Hello, world!");
        } else {
            panic!("Expected a crypto message");
        }
    } else {
        panic!("Expected a message event");
    }
}

fn init_test_data(
    env: &mut StateMachine,
    canister_ids: &CanisterIds,
    controller: Principal
) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let community_id = client::user::happy_path::create_community(env, &user1, &random_string(), true, vec!["general".to_string()]);
    client::local_user_index::happy_path::join_community(env, user2.principal, canister_ids.local_user_index, community_id);

    env.tick();

    let summary = client::community::happy_path::summary(env, &user2, community_id);
    let channel_id = summary.channels.iter().find(|c| c.name == "general").unwrap().channel_id;

    TestData { user1, user2, community_id, channel_id }
}

#[allow(dead_code)]
struct TestData {
    user1: User,
    user2: User,
    community_id: CommunityId,
    channel_id: ChannelId,
}
