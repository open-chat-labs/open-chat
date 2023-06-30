use crate::env::ENV;
use crate::rng::random_string;
use crate::utils::tick_many;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use ic_test_state_machine_client::StateMachine;
use std::ops::Deref;
use types::{CommunityId, MessageContent};

#[test]
fn block_user_succeeds() {
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
        community_name,
    } = init_test_data(env, canister_ids, *controller, true);

    // Block user2
    let block_user_response = client::community::block_user(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::block_user::Args { user_id: user2.user_id },
    );

    assert!(matches!(
        block_user_response,
        community_canister::block_user::Response::Success
    ));

    // Check user has been blocked
    let response = client::community::happy_path::selected_initial(env, &user1, community_id);

    assert!(response.blocked_users.contains(&user2.user_id));
    assert!(!response.members.iter().any(|member| member.user_id == user2.user_id));

    tick_many(env, 3);

    // Check user canister that user is no longer in community
    let initial_state = client::user::happy_path::initial_state(env, &user2);
    assert!(!initial_state
        .communities
        .summaries
        .iter()
        .any(|c| c.community_id == community_id));

    // Check bot message received
    let user1_id = user1.user_id;
    assert!(initial_state.direct_chats.summaries.iter().any(|dc| {
        if let MessageContent::Text(content) = &dc.latest_message.event.content {
            content.text == format!("You were blocked from the public community \"{community_name}\" by @UserId({user1_id})")
        } else {
            false
        }
    }));
}

#[test]
fn block_user_fails_for_private_communities() {
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
        community_name: _,
    } = init_test_data(env, canister_ids, *controller, false);

    let block_user_response = client::community::block_user(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::block_user::Args { user_id: user2.user_id },
    );

    assert!(matches!(
        block_user_response,
        community_canister::block_user::Response::CommunityNotPublic
    ));
}

#[test]
fn remove_user_succeeds() {
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
        community_name,
    } = init_test_data(env, canister_ids, *controller, false);

    // Remove user2
    let remove_member_response = client::community::remove_member(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::remove_member::Args { user_id: user2.user_id },
    );

    assert!(matches!(
        remove_member_response,
        community_canister::remove_member::Response::Success
    ));

    // Check user has been removed
    let response = client::community::happy_path::selected_initial(env, &user1, community_id);

    assert!(!response.blocked_users.contains(&user2.user_id));
    assert!(!response.members.iter().any(|member| member.user_id == user2.user_id));

    tick_many(env, 3);

    // Check user canister that user is no longer in community
    let initial_state = client::user::happy_path::initial_state(env, &user2);
    assert!(!initial_state
        .communities
        .summaries
        .iter()
        .any(|c| c.community_id == community_id));

    // Check bot message received
    let user1_id = user1.user_id;
    assert!(initial_state.direct_chats.summaries.iter().any(|dc| {
        if let MessageContent::Text(content) = &dc.latest_message.event.content {
            content.text == format!("You were removed from the private community \"{community_name}\" by @UserId({user1_id})")
        } else {
            false
        }
    }));
}

fn init_test_data(env: &mut StateMachine, canister_ids: &CanisterIds, controller: Principal, public: bool) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let community_name = random_string();

    let community_id =
        client::user::happy_path::create_community(env, &user1, &community_name, public, vec!["abcde".to_string()]);

    if !public {
        client::local_user_index::happy_path::invite_users_to_community(
            env,
            user1.principal,
            canister_ids.local_user_index,
            community_id,
            vec![user2.user_id],
        );
    }

    client::local_user_index::happy_path::join_community(env, user2.principal, canister_ids.local_user_index, community_id);

    TestData {
        user1,
        user2,
        community_id,
        community_name,
    }
}

struct TestData {
    user1: User,
    user2: User,
    community_id: CommunityId,
    community_name: String,
}
