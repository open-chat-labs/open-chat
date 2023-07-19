use crate::env::ENV;
use crate::rng::random_string;
use crate::utils::tick_many;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use ic_test_state_machine_client::StateMachine;
use std::ops::Deref;
use types::{ChannelId, CommunityId, MessageContent};

#[test]
fn join_public_channel_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData {
        user1: _,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller, true);

    client::local_user_index::happy_path::join_channel(
        env,
        user2.principal,
        community_id,
        channel_id,
        canister_ids.local_user_index,
    );

    env.tick();

    let summary = client::community::happy_path::summary(env, &user2, community_id);

    assert!(summary.channels.iter().any(|c| c.channel_id == channel_id));
}

#[test]
fn join_private_channel_fails() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData {
        user1: _,
        user2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller, false);

    let response = client::local_user_index::join_channel(
        env,
        user2.principal,
        canister_ids.local_user_index,
        &local_user_index_canister::join_channel::Args {
            community_id,
            channel_id,
            invite_code: None,
        },
    );

    assert!(matches!(
        response,
        local_user_index_canister::join_channel::Response::NotInvited
    ));
}

#[test]
fn join_private_community_with_invitation_succeeds() {
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
    } = init_test_data(env, canister_ids, *controller, false);

    client::local_user_index::happy_path::invite_users_to_channel(
        env,
        user1.principal,
        canister_ids.local_user_index,
        community_id,
        channel_id,
        vec![user2.user_id],
    );

    client::local_user_index::happy_path::join_channel(
        env,
        user2.principal,
        community_id,
        channel_id,
        canister_ids.local_user_index,
    );

    env.tick();

    let summary = client::community::happy_path::summary(env, &user2, community_id);

    assert!(summary.channels.iter().any(|c| c.channel_id == channel_id));
}

#[test]
fn invite_to_channel_oc_bot_message_received() {
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
    } = init_test_data(env, canister_ids, *controller, false);

    client::local_user_index::happy_path::invite_users_to_channel(
        env,
        user1.principal,
        canister_ids.local_user_index,
        community_id,
        channel_id,
        vec![user2.user_id],
    );

    tick_many(env, 3);

    let initial_state = client::user::happy_path::initial_state(env, &user2);

    assert!(initial_state.direct_chats.summaries.iter().any(|dc| {
        if let MessageContent::Text(content) = &dc.latest_message.event.content {
            content.text.contains("You have been invited to the channel") && content.text.contains(&channel_id.to_string())
        } else {
            false
        }
    }));
}

fn init_test_data(env: &mut StateMachine, canister_ids: &CanisterIds, controller: Principal, public: bool) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let community_name = random_string();
    let channel_name = random_string();

    let community_id =
        client::user::happy_path::create_community(env, &user1, &community_name, true, vec!["abcde".to_string()]);

    client::local_user_index::happy_path::join_community(env, user2.principal, canister_ids.local_user_index, community_id);

    let channel_id = client::community::happy_path::create_channel(env, user1.principal, community_id, public, channel_name);

    env.tick();

    TestData {
        user1,
        user2,
        community_id,
        channel_id,
    }
}

#[allow(dead_code)]
struct TestData {
    user1: User,
    user2: User,
    community_id: CommunityId,
    channel_id: ChannelId,
}
