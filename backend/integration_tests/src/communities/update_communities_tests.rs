use crate::env::ENV;
use crate::utils::tick_many;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::{CommunityId, CommunityPermissionRole, OptionUpdate, OptionalCommunityPermissions};

#[test]
fn change_casing_of_community_name_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let community_name = "community_change_casing".to_string();
    let TestData {
        user1,
        user2,
        community_id,
    } = init_test_data(env, canister_ids, *controller, &community_name);

    // Update the community name
    let new_community_name = community_name.to_uppercase();
    client::community::happy_path::update_community(
        env,
        user1.principal,
        community_id,
        &community_canister::update_community::Args {
            name: Some(new_community_name.clone()),
            description: None,
            rules: None,
            avatar: OptionUpdate::NoChange,
            banner: OptionUpdate::NoChange,
            permissions: None,
            gate_config: OptionUpdate::NoChange,
            public: None,
            primary_language: None,
        },
    );

    // Check the name has changed
    let summary = client::community::happy_path::summary(env, user2.principal, community_id);
    assert_eq!(summary.name, new_community_name);

    tick_many(env, 3);

    // Find the community in the group_index and check that the name has changed
    let communities = client::group_index::happy_path::explore_communities(env, &user2, canister_ids.group_index);
    assert!(communities
        .iter()
        .any(|m| m.id == community_id && m.name == new_community_name));
}

#[test]
fn update_permissions_succeeds() {
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
    } = init_test_data(env, canister_ids, *controller, &random_string());

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
            update_details: None,
            create_public_channel: Some(CommunityPermissionRole::Owners),
            create_private_channel: None,
            manage_user_groups: None,
        }),
        gate_config: OptionUpdate::NoChange,
        public: None,
        primary_language: None,
    };

    client::community::happy_path::update_community(env, user1.principal, community_id, &args);

    let result = client::community::happy_path::summary(env, user2.principal, community_id);

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
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        community_id,
    } = init_test_data(env, canister_ids, *controller, &random_string());

    let summary = client::community::happy_path::summary(env, user2.principal, community_id);

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
            update_details: None,
            create_public_channel: Some(CommunityPermissionRole::Owners),
            create_private_channel: None,
            manage_user_groups: None,
        }),
        gate_config: OptionUpdate::NoChange,
        public: None,
        primary_language: None,
    };

    client::community::happy_path::update_community(env, user1.principal, community_id, &args);

    let result = match client::community::happy_path::summary_updates(env, user2.principal, community_id, summary.last_updated)
    {
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

#[test]
fn make_private_community_public_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);

    let community_id = client::user::happy_path::create_community(env, &user, &random_string(), false, vec!["abc".to_string()]);

    let args = community_canister::update_community::Args {
        name: None,
        description: None,
        rules: None,
        avatar: OptionUpdate::NoChange,
        banner: OptionUpdate::NoChange,
        permissions: None,
        gate_config: OptionUpdate::NoChange,
        public: Some(true),
        primary_language: None,
    };

    client::community::happy_path::update_community(env, user.principal, community_id, &args);

    let result = client::community::happy_path::summary(env, user.principal, community_id);

    assert!(result.is_public);

    assert!(
        client::group_index::happy_path::explore_communities(env, &user, canister_ids.group_index)
            .into_iter()
            .any(|c| c.id == community_id)
    );
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal, community_name: &str) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);

    let user2 = client::register_user(env, canister_ids);

    let community_id =
        client::user::happy_path::create_community(env, &user1, community_name, true, vec!["general".to_string()]);

    client::community::happy_path::join_community(env, user2.principal, community_id);

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
