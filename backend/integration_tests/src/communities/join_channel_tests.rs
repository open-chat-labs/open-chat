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
        canister_ids.local_user_index,
        community_id,
        channel_id,
    );

    tick_many(env, 3);

    let summary = client::community::happy_path::summary(env, &user2, community_id);

    assert!(summary.channels.iter().any(|c| c.channel_id == channel_id));

    let initial_state = client::user::happy_path::initial_state(env, &user2);

    assert!(initial_state
        .communities
        .summaries
        .iter()
        .any(|c| c.community_id == community_id));
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
        canister_ids.local_user_index,
        community_id,
        channel_id,
    );

    env.tick();

    let summary = client::community::happy_path::summary(env, &user2, community_id);

    assert!(summary.channels.iter().any(|c| c.channel_id == channel_id));
}

#[test]
fn join_community_and_channel_in_single_call_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData {
        user1: _,
        user2: _,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller, true);

    let user3 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let response = client::local_user_index::join_channel(
        env,
        user3.principal,
        canister_ids.local_user_index,
        &local_user_index_canister::join_channel::Args {
            community_id,
            channel_id,
            invite_code: None,
        },
    );

    assert!(matches!(
        response,
        local_user_index_canister::join_channel::Response::SuccessJoinedCommunity(_)
    ));
}

#[test]
fn invite_non_community_member_to_channel_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData {
        user1,
        user2: _,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller, false);

    let user3 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let invite_users_response = client::local_user_index::invite_users_to_channel(
        env,
        user1.principal,
        canister_ids.local_user_index,
        &local_user_index_canister::invite_users_to_channel::Args {
            community_id,
            channel_id,
            user_ids: vec![user3.user_id],
        },
    );

    assert!(matches!(
        invite_users_response,
        local_user_index_canister::invite_users_to_channel::Response::Success
    ));

    let join_channel_response = client::local_user_index::join_channel(
        env,
        user3.principal,
        canister_ids.local_user_index,
        &local_user_index_canister::join_channel::Args {
            community_id,
            channel_id,
            invite_code: None,
        },
    );

    assert!(matches!(
        join_channel_response,
        local_user_index_canister::join_channel::Response::SuccessJoinedCommunity(_)
    ));
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

#[test]
fn channel_marked_as_read_after_joining() {
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
    } = init_test_data(env, canister_ids, *controller, true);

    client::community::happy_path::send_text_message(env, &user1, community_id, channel_id, None, random_string(), None);
    client::community::happy_path::send_text_message(env, &user1, community_id, channel_id, None, random_string(), None);
    client::community::happy_path::send_text_message(env, &user1, community_id, channel_id, None, random_string(), None);

    let user3 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    client::local_user_index::happy_path::join_channel(
        env,
        user2.principal,
        canister_ids.local_user_index,
        community_id,
        channel_id,
    );

    client::local_user_index::happy_path::join_channel(
        env,
        user3.principal,
        canister_ids.local_user_index,
        community_id,
        channel_id,
    );

    tick_many(env, 3);

    let user2_initial_state = client::user::happy_path::initial_state(env, &user2);
    let user3_initial_state = client::user::happy_path::initial_state(env, &user3);

    let user2_community = user2_initial_state
        .communities
        .summaries
        .iter()
        .find(|c| c.community_id == community_id)
        .unwrap();

    let user3_community = user3_initial_state
        .communities
        .summaries
        .iter()
        .find(|c| c.community_id == community_id)
        .unwrap();

    let user2_channel = user2_community.channels.iter().find(|c| c.channel_id == channel_id).unwrap();
    let user3_channel = user3_community.channels.iter().find(|c| c.channel_id == channel_id).unwrap();

    assert_eq!(user2_channel.read_by_me_up_to, Some(2.into()));
    assert_eq!(user3_channel.read_by_me_up_to, Some(2.into()));
}

fn init_test_data(env: &mut StateMachine, canister_ids: &CanisterIds, controller: Principal, public: bool) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let community_name = random_string();
    let channel_name = random_string();

    let community_id =
        client::user::happy_path::create_community(env, &user1, &community_name, true, vec!["abcde".to_string()]);

    client::local_user_index::happy_path::join_community(env, user2.principal, canister_ids.local_user_index, community_id);

    let channel_id =
        client::community::happy_path::create_channel(env, user1.principal, community_id, public, channel_name, public);

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
