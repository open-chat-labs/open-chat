use crate::env::ENV;
use crate::utils::tick_many;
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use testing::rng::random_string;
use types::{
    ChatId, CustomPermission, GroupPermissionRole, OptionUpdate::*, OptionalGroupPermissions, OptionalMessagePermissions,
};

#[test]
fn update_group_name_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2, group_id } = init_test_data(env, canister_ids, *controller, &random_string());

    // Update the group name
    let new_group_name = random_string();
    client::group::happy_path::update_group(
        env,
        user1.principal,
        group_id,
        &group_canister::update_group_v2::Args {
            name: Some(new_group_name.clone()),
            description: None,
            rules: None,
            avatar: NoChange,
            permissions_v2: None,
            events_ttl: NoChange,
            public: None,

            gate_config: NoChange,
            messages_visible_to_non_members: None,
        },
    );

    // Check the name has changed
    let summary = client::group::happy_path::summary(env, user2.principal, group_id);
    assert_eq!(summary.name, new_group_name);

    tick_many(env, 3);

    // Find the group in the group_index and check that the name has changed
    let groups =
        client::group_index::happy_path::explore_groups(env, user2.principal, canister_ids.group_index, &new_group_name);
    assert!(groups.iter().any(|m| m.id == group_id && m.name == new_group_name));
}

#[test]
fn change_casing_of_group_name_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let group_name = "group_change_casing".to_string();
    let TestData { user1, user2, group_id } = init_test_data(env, canister_ids, *controller, &group_name);

    // Update the group name
    let new_group_name = group_name.to_uppercase();
    client::group::happy_path::update_group(
        env,
        user1.principal,
        group_id,
        &group_canister::update_group_v2::Args {
            name: Some(new_group_name.clone()),
            description: None,
            rules: None,
            avatar: NoChange,
            permissions_v2: None,
            events_ttl: NoChange,
            public: None,

            gate_config: NoChange,
            messages_visible_to_non_members: None,
        },
    );

    // Check the name has changed
    let summary = client::group::happy_path::summary(env, user2.principal, group_id);
    assert_eq!(summary.name, new_group_name);

    tick_many(env, 3);

    // Find the group in the group_index and check that the name has changed
    let matches =
        client::group_index::happy_path::explore_groups(env, user2.principal, canister_ids.group_index, &new_group_name);
    assert!(matches.iter().any(|m| m.id == group_id && m.name == new_group_name));
}

#[test]
fn update_group_privacy_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let group_name = random_string();
    let TestData { user1, user2, group_id } = init_test_data(env, canister_ids, *controller, &group_name);

    // Find the group in the group_index
    let matches = client::group_index::happy_path::explore_groups(env, user2.principal, canister_ids.group_index, &group_name);
    assert!(matches.iter().any(|m| m.id == group_id));

    // Update the privacy and name
    let new_group_name = random_string();
    client::group::happy_path::update_group(
        env,
        user1.principal,
        group_id,
        &group_canister::update_group_v2::Args {
            name: Some(new_group_name.clone()),
            description: None,
            rules: None,
            avatar: NoChange,
            permissions_v2: None,
            events_ttl: NoChange,
            public: Some(false),

            gate_config: NoChange,
            messages_visible_to_non_members: None,
        },
    );

    // Check the privacy and name have changed
    let summary = client::group::happy_path::summary(env, user2.principal, group_id);
    assert_eq!(summary.name, new_group_name);
    assert!(!summary.is_public);

    tick_many(env, 3);

    // Confirm the group can now *not* be found in the group_index, under either name
    for name in [&group_name, &new_group_name] {
        let matches = client::group_index::happy_path::explore_groups(env, user2.principal, canister_ids.group_index, name);
        assert!(!matches.iter().any(|m| m.id == group_id));
    }
}

#[test]
fn make_private_group_public_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);

    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), false, true);

    for i in 0..5 {
        client::group::happy_path::send_text_message(env, &user1, group_id, None, i.to_string(), None);
    }

    client::group::happy_path::update_group(
        env,
        user1.principal,
        group_id,
        &group_canister::update_group_v2::Args {
            name: None,
            description: None,
            rules: None,
            avatar: NoChange,
            permissions_v2: None,
            events_ttl: NoChange,
            gate_config: NoChange,
            public: Some(true),

            messages_visible_to_non_members: None,
        },
    );

    client::group::happy_path::join_group(env, user2.principal, group_id);

    let group_summary = client::group::happy_path::summary(env, user2.principal, group_id);

    assert!(group_summary.is_public);
    assert_eq!(group_summary.min_visible_event_index, 6.into());
    assert_eq!(group_summary.min_visible_message_index, 5.into());
}

#[test]
fn meme_fighter_permission_set_for_the_first_time_is_saved_and_can_be_removed() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2, group_id } = init_test_data(env, canister_ids, *controller, &random_string());

    // Set for the first time, alongside a subtype the backend doesn't know
    update_custom_permissions(
        env,
        user1.principal,
        group_id,
        vec![
            CustomPermission {
                subtype: "meme_fighter".to_string(),
                role: GroupPermissionRole::Admins,
            },
            CustomPermission {
                subtype: random_string(),
                role: GroupPermissionRole::Admins,
            },
        ],
        Vec::new(),
    );

    // A member reads it back: the group kept Meme Fighter's and dropped the unknown one
    let summary = client::group::happy_path::summary(env, user2.principal, group_id);
    let custom = summary.permissions_v2.message_permissions.custom;
    assert_eq!(custom.len(), 1, "{custom:?}");
    assert_eq!(custom[0].subtype, "meme_fighter");
    assert_eq!(custom[0].role, GroupPermissionRole::Admins);

    // Back to "Same as default"
    update_custom_permissions(env, user1.principal, group_id, Vec::new(), vec!["meme_fighter".to_string()]);

    let summary = client::group::happy_path::summary(env, user2.principal, group_id);
    assert!(
        summary.permissions_v2.message_permissions.custom.is_empty(),
        "{:?}",
        summary.permissions_v2.message_permissions.custom
    );
}

fn update_custom_permissions(
    env: &mut PocketIc,
    sender: Principal,
    group_id: ChatId,
    custom_updated: Vec<CustomPermission>,
    custom_deleted: Vec<String>,
) {
    client::group::happy_path::update_group(
        env,
        sender,
        group_id,
        &group_canister::update_group_v2::Args {
            name: None,
            description: None,
            rules: None,
            avatar: NoChange,
            permissions_v2: Some(OptionalGroupPermissions {
                message_permissions: Some(OptionalMessagePermissions {
                    custom_updated,
                    custom_deleted,
                    ..Default::default()
                }),
                ..Default::default()
            }),
            events_ttl: NoChange,
            gate_config: NoChange,
            public: None,
            messages_visible_to_non_members: None,
        },
    );
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal, group_name: &str) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);

    let group_id = client::user::happy_path::create_group(env, &user1, group_name, true, true);
    client::group::happy_path::join_group(env, user2.principal, group_id);

    tick_many(env, 3);

    TestData { user1, user2, group_id }
}

struct TestData {
    user1: User,
    user2: User,
    group_id: ChatId,
}
