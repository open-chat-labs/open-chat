use crate::env::ENV;
use crate::rng::random_string;
use crate::utils::tick_many;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use ic_test_state_machine_client::StateMachine;
use std::ops::Deref;
use types::{CommunityId, Empty, MessageContent};

#[test]
fn join_public_community_succeeds() {
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
    } = init_test_data(env, canister_ids, *controller, true);

    client::local_user_index::happy_path::join_community(env, user2.principal, canister_ids.local_user_index, community_id);

    env.tick();

    let initial_state = client::user::happy_path::initial_state(env, &user2);

    assert!(initial_state
        .communities
        .summaries
        .iter()
        .any(|c| c.community_id == community_id));
}

#[test]
fn join_private_community_fails() {
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
    } = init_test_data(env, canister_ids, *controller, false);

    let response = client::local_user_index::join_community(
        env,
        user2.principal,
        canister_ids.local_user_index,
        &local_user_index_canister::join_community::Args {
            community_id,
            invite_code: None,
        },
    );

    assert!(matches!(
        response,
        local_user_index_canister::join_community::Response::NotInvited
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
    } = init_test_data(env, canister_ids, *controller, false);

    client::local_user_index::happy_path::invite_users_to_community(
        env,
        user1.principal,
        canister_ids.local_user_index,
        community_id,
        vec![user2.user_id],
    );

    client::local_user_index::happy_path::join_community(env, user2.principal, canister_ids.local_user_index, community_id);

    env.tick();

    let initial_state = client::user::happy_path::initial_state(env, &user2);

    assert!(initial_state
        .communities
        .summaries
        .iter()
        .any(|c| c.community_id == community_id));
}

#[test]
fn join_private_community_using_invite_code_succeeds() {
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
    } = init_test_data(env, canister_ids, *controller, false);

    let invite_code_response = client::community::enable_invite_code(env, user1.principal, community_id.into(), &Empty {});

    let invite_code = if let community_canister::enable_invite_code::Response::Success(result) = invite_code_response {
        result.code
    } else {
        panic!()
    };

    let response = client::local_user_index::join_community(
        env,
        user2.principal,
        canister_ids.local_user_index,
        &local_user_index_canister::join_community::Args {
            community_id,
            invite_code: Some(invite_code),
        },
    );

    assert!(matches!(
        response,
        local_user_index_canister::join_community::Response::Success(_)
    ));

    env.tick();

    let initial_state = client::user::happy_path::initial_state(env, &user2);

    assert!(initial_state
        .communities
        .summaries
        .iter()
        .any(|c| c.community_id == community_id));
}

#[test]
fn invite_to_community_oc_bot_message_received() {
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
    } = init_test_data(env, canister_ids, *controller, false);

    client::local_user_index::happy_path::invite_users_to_community(
        env,
        user1.principal,
        canister_ids.local_user_index,
        community_id,
        vec![user2.user_id],
    );

    tick_many(env, 3);

    let initial_state = client::user::happy_path::initial_state(env, &user2);

    assert!(initial_state.direct_chats.summaries.iter().any(|dc| {
        if let MessageContent::Text(content) = &dc.latest_message.event.content {
            content.text.contains("You have been invited to the community") && content.text.contains(&community_id.to_string())
        } else {
            false
        }
    }));
}

#[test]
fn default_channels_marked_as_read_after_joining() {
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
    } = init_test_data(env, canister_ids, *controller, true);

    let default1 =
        client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string(), true);
    let default2 =
        client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string(), true);
    let default3 =
        client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string(), true);

    let user3 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    for i in 0..3 {
        if i < 1 {
            client::community::happy_path::send_text_message(env, &user1, community_id, default1, None, random_string(), None);
        }

        if i < 2 {
            client::community::happy_path::send_text_message(env, &user1, community_id, default2, None, random_string(), None);
        }

        client::community::happy_path::send_text_message(env, &user1, community_id, default3, None, random_string(), None);
    }

    client::local_user_index::happy_path::join_community(env, user3.principal, canister_ids.local_user_index, community_id);

    tick_many(env, 3);

    let initial_state = client::user::happy_path::initial_state(env, &user3);

    let community = initial_state
        .communities
        .summaries
        .iter()
        .find(|c| c.community_id == community_id)
        .unwrap();

    let channel1 = community.channels.iter().find(|c| c.channel_id == default1).unwrap();
    assert_eq!(channel1.read_by_me_up_to, Some(0.into()));

    let channel2 = community.channels.iter().find(|c| c.channel_id == default2).unwrap();
    assert_eq!(channel2.read_by_me_up_to, Some(1.into()));

    let channel3 = community.channels.iter().find(|c| c.channel_id == default3).unwrap();
    assert_eq!(channel3.read_by_me_up_to, Some(2.into()));
}

fn init_test_data(env: &mut StateMachine, canister_ids: &CanisterIds, controller: Principal, public: bool) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let community_name = random_string();

    let community_id =
        client::user::happy_path::create_community(env, &user1, &community_name, public, vec!["abcde".to_string()]);

    TestData {
        user1,
        user2,
        community_id,
    }
}

struct TestData {
    user1: User,
    user2: User,
    community_id: CommunityId,
}
