use crate::env::ENV;
use crate::rng::random_string;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use ic_test_state_machine_client::StateMachine;
use std::ops::Deref;
use types::{CommunityId, Empty};

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

    assert!(initial_state.communities.iter().any(|c| c.community_id == community_id));
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

    assert!(matches!(response,local_user_index_canister::join_community::Response::NotInvited));
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
        community_id 
    } = init_test_data(env, canister_ids, *controller, false);

    client::local_user_index::happy_path::invite_users_to_community(
        env,
        user1.principal,
        canister_ids.local_user_index,
        community_id,
        vec![user2.user_id],
    );

    client::local_user_index::happy_path::join_community(
        env, 
        user2.principal, 
        canister_ids.local_user_index, 
        community_id);

    env.tick();

    let initial_state = client::user::happy_path::initial_state(env, &user2);

    assert!(initial_state.communities.iter().any(|c| c.community_id == community_id));
}

#[test]
fn join_private_community_using_invite_code_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { user1, user2, community_id } = init_test_data(env, canister_ids, *controller, false);

    let invite_code_response = client::community::enable_invite_code(
        env,
        user1.principal,
        community_id.into(),
        &Empty {},
    );

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

    assert!(matches!(response,local_user_index_canister::join_community::Response::Success(_)));

    env.tick();

    let initial_state = client::user::happy_path::initial_state(env, &user2);

    assert!(initial_state.communities.iter().any(|c| c.community_id == community_id));
}

fn init_test_data(env: &mut StateMachine, canister_ids: &CanisterIds, controller: Principal, public: bool) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let community_name = random_string();

    let community_id = client::user::happy_path::create_community(env, &user1, &community_name, public);

    TestData {
        user1,
        user2,
        community_id,
    }
}

#[allow(dead_code)]
struct TestData {
    user1: User,
    user2: User,
    community_id: CommunityId,
}
