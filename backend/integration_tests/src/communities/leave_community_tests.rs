use crate::env::ENV;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use testing::rng::random_string;
use types::{CommunityId, CommunityRole};

#[test]
fn leave_community_succeeds() {
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

    client::user::happy_path::leave_community(env, &user2, community_id);

    env.tick();

    let initial_state = client::user::happy_path::initial_state(env, &user2);

    assert!(initial_state.communities.summaries.is_empty())
}

#[test]
fn cannot_leave_community_if_last_owner() {
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

    client::community::happy_path::join_community(env, user2.principal, community_id);

    let leave_community_response = client::user::leave_community(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::leave_community::Args { community_id },
    );

    assert!(matches!(
        leave_community_response,
        user_canister::leave_community::Response::LastOwnerCannotLeave
    ));

    let initial_state = client::user::happy_path::initial_state(env, &user1);

    assert!(!initial_state.communities.summaries.is_empty())
}

#[test]
fn cannot_leave_community_if_last_owner_of_a_channel() {
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

    client::community::happy_path::join_community(env, user2.principal, community_id);
    client::community::happy_path::change_role(env, user1.principal, community_id, user2.user_id, CommunityRole::Owner);
    client::community::happy_path::create_channel(env, user2.principal, community_id, true, random_string());

    let leave_community_response = client::user::leave_community(
        env,
        user2.principal,
        user2.canister(),
        &user_canister::leave_community::Args { community_id },
    );

    assert!(matches!(
        leave_community_response,
        user_canister::leave_community::Response::LastOwnerCannotLeave
    ));

    let initial_state = client::user::happy_path::initial_state(env, &user2);

    assert!(!initial_state.communities.summaries.is_empty())
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
