use crate::env::ENV;
use crate::rng::random_string;
use crate::utils::tick_many;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use group_canister::update_group_v2;
use ic_test_state_machine_client::StateMachine;
use std::ops::Deref;
use types::{ChatId, OptionUpdate::*};

#[test]
fn update_group_name_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { user1, user2, group_id } = init_test_data(env, canister_ids, *controller);

    // Update the group name
    let new_group_name = random_string();
    update_group(
        env,
        &user1,
        group_id,
        group_canister::update_group_v2::Args {
            name: Some(new_group_name.clone()),
            description: None,
            rules: None,
            avatar: NoChange,
            permissions: None,
            events_ttl: NoChange,
            public: None,
            correlation_id: 0,
            gate: NoChange,
        },
    );

    // Check the name has changed
    let summary = client::group::happy_path::summary(env, &user2, group_id);
    assert_eq!(summary.name, new_group_name);

    tick_many(env, 3);

    // Find the group in the group_index and check that the name has changed
    let matches = client::group_index::happy_path::explore_groups(env, &user2, canister_ids.group_index);
    assert!(matches.iter().any(|m| m.id == group_id && m.name == new_group_name));
}

#[test]
fn update_group_privacy_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { user1, user2, group_id } = init_test_data(env, canister_ids, *controller);

    // Find the group in the group_index
    let matches = client::group_index::happy_path::explore_groups(env, &user2, canister_ids.group_index);
    assert!(matches.iter().any(|m| m.id == group_id));

    // Update the privacy and name
    let new_group_name = random_string();
    update_group(
        env,
        &user1,
        group_id,
        group_canister::update_group_v2::Args {
            name: Some(new_group_name.clone()),
            description: None,
            rules: None,
            avatar: NoChange,
            permissions: None,
            events_ttl: NoChange,
            public: Some(false),
            correlation_id: 0,
            gate: NoChange,
        },
    );

    // Check the privacy and name have changed
    let summary = client::group::happy_path::summary(env, &user2, group_id);
    assert_eq!(summary.name, new_group_name);
    assert_eq!(summary.is_public, false);

    tick_many(env, 3);

    // Confirm the group can now *not* be found in the group_index
    let matches = client::group_index::happy_path::explore_groups(env, &user2, canister_ids.group_index);
    assert!(!matches.iter().any(|m| m.id == group_id));
}

fn update_group(env: &mut StateMachine, user: &User, group_chat_id: ChatId, args: update_group_v2::Args) {
    let response = client::group::update_group_v2(env, user.principal, group_chat_id.into(), &args);

    if !matches!(response, group_canister::update_group_v2::Response::Success) {
        panic!("'update_group_v2' error: {response:?}");
    }
}

fn init_test_data(env: &mut StateMachine, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), true, true);
    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);

    tick_many(env, 3);

    TestData { user1, user2, group_id }
}

struct TestData {
    user1: User,
    user2: User,
    group_id: ChatId,
}
