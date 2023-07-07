use crate::env::ENV;
use crate::rng::random_string;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use ic_test_state_machine_client::StateMachine;
use std::ops::Deref;
use std::time::Duration;
use types::{CommunityId, CommunityPermissionRole, OptionUpdate, OptionalCommunityPermissions};

#[test]
fn update_permissions_succeeds() {
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
    } = init_test_data(env, canister_ids, *controller);

    let args = community_canister::update_community::Args {
        name: None,
        description: Some("New description".to_string()),
        rules: None,
        avatar: OptionUpdate::NoChange,
        banner: OptionUpdate::NoChange,
        permissions: Some(OptionalCommunityPermissions {
            change_roles: None,
            invite_users: None,
            remove_members: None,
            block_users: None,
            update_details: None,
            create_public_channel: Some(CommunityPermissionRole::Owners),
            create_private_channel: None,
        }),
        gate: OptionUpdate::NoChange,
        public: None,
        primary_language: None,
    };

    client::community::happy_path::update_community(env, &user1, community_id, &args);

    let result = client::community::happy_path::summary(env, &user2, community_id);

    assert_eq!(result.description, "New description");
    assert!(matches!(
        result.permissions.create_public_channel,
        CommunityPermissionRole::Owners
    ));
}

#[test]
fn update_permissions_summary_updates_succeeds() {
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
    } = init_test_data(env, canister_ids, *controller);

    let summary = client::community::happy_path::summary(env, &user2, community_id);

    env.advance_time(Duration::from_millis(1000));

    let args = community_canister::update_community::Args {
        name: None,
        description: None,
        rules: None,
        avatar: OptionUpdate::NoChange,
        banner: OptionUpdate::NoChange,
        permissions: Some(OptionalCommunityPermissions {
            change_roles: None,
            invite_users: None,
            remove_members: None,
            block_users: None,
            update_details: None,
            create_public_channel: Some(CommunityPermissionRole::Owners),
            create_private_channel: None,
        }),
        gate: OptionUpdate::NoChange,
        public: None,
        primary_language: None,
    };

    client::community::happy_path::update_community(env, &user1, community_id, &args);

    let result = match client::community::happy_path::summary_updates(env, &user2, community_id, summary.last_updated) {
        Some(r) => r,
        None => {
            panic!("Expected summary_updates")
        }
    };

    assert_eq!(result.description, None);

    match result.permissions {
        Some(ps) => {
            assert!(matches!(ps.create_public_channel, CommunityPermissionRole::Owners));
        }
        None => panic!("Expected permissions updated"),
    }
}

fn init_test_data(env: &mut StateMachine, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);

    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let community_id =
        client::user::happy_path::create_community(env, &user1, &random_string(), true, vec!["general".to_string()]);

    client::local_user_index::happy_path::join_community(env, user2.principal, canister_ids.local_user_index, community_id);

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
