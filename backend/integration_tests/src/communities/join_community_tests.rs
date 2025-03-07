use crate::env::ENV;
use crate::utils::tick_many;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use pocket_ic::PocketIc;
use std::collections::HashSet;
use std::ops::Deref;
use test_case::test_case;
use testing::rng::random_string;
use types::{AccessGate, CommunityId, Empty, MessageContent};

#[test]
fn join_public_community_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1: _,
        user2,
        community_id,
    } = init_test_data(env, canister_ids, *controller, true);

    client::community::happy_path::join_community(env, user2.principal, community_id);

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
        ..
    } = wrapper.env();

    let TestData {
        user1: _,
        user2,
        community_id,
    } = init_test_data(env, canister_ids, *controller, false);

    let response = client::local_user_index::join_community(
        env,
        user2.principal,
        canister_ids.local_user_index(env, community_id),
        &local_user_index_canister::join_community::Args {
            community_id,
            invite_code: None,
            referred_by: None,
            verified_credential_args: None,
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
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
    } = init_test_data(env, canister_ids, *controller, false);

    client::local_user_index::happy_path::invite_users_to_community(
        env,
        &user1,
        canister_ids.local_user_index(env, community_id),
        community_id,
        vec![user2.user_id],
    );

    client::community::happy_path::join_community(env, user2.principal, community_id);

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
        ..
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
        canister_ids.local_user_index(env, community_id),
        &local_user_index_canister::join_community::Args {
            community_id,
            invite_code: Some(invite_code),
            referred_by: None,
            verified_credential_args: None,
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
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
    } = init_test_data(env, canister_ids, *controller, false);

    client::local_user_index::happy_path::invite_users_to_community(
        env,
        &user1,
        canister_ids.local_user_index(env, community_id),
        community_id,
        vec![user2.user_id],
    );

    tick_many(env, 3);

    let initial_state = client::user::happy_path::initial_state(env, &user2);

    assert!(initial_state.direct_chats.summaries.iter().any(|dc| {
        if let MessageContent::Text(content) = &dc.latest_message.as_ref().unwrap().event.content {
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
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2: _,
        community_id,
    } = init_test_data(env, canister_ids, *controller, true);

    let default1 = client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string());
    let default2 = client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string());
    let default3 = client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string());

    let user3 = client::register_user(env, canister_ids);

    for i in 0..3 {
        if i < 1 {
            client::community::happy_path::send_text_message(env, &user1, community_id, default1, None, random_string(), None);
        }

        if i < 2 {
            client::community::happy_path::send_text_message(env, &user1, community_id, default2, None, random_string(), None);
        }

        client::community::happy_path::send_text_message(env, &user1, community_id, default3, None, random_string(), None);
    }

    client::community::happy_path::join_community(env, user3.principal, community_id);

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

#[test_case(true)]
#[test_case(false)]
fn user_joined_to_all_public_channels(diamond_member: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
    } = init_test_data(env, canister_ids, *controller, true);

    let user = if diamond_member { client::register_diamond_user(env, canister_ids, *controller) } else { user2 };

    let channel1 = client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string());
    let channel2 = client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string());
    let channel3 = client::community::happy_path::create_channel(env, user1.principal, community_id, false, random_string());
    let channel4 = client::community::happy_path::create_gated_channel(
        env,
        user1.principal,
        community_id,
        true,
        random_string(),
        AccessGate::DiamondMember,
    );

    let community_summary = client::community::happy_path::join_community(env, user.principal, community_id);

    let channel_ids: HashSet<_> = community_summary.channels.iter().map(|c| c.channel_id).collect();

    assert!(channel_ids.contains(&channel1));
    assert!(channel_ids.contains(&channel2));
    assert!(!channel_ids.contains(&channel3));
    assert_eq!(channel_ids.contains(&channel4), diamond_member);
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal, public: bool) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);

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
