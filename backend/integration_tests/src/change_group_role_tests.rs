use crate::env::ENV;
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use testing::rng::random_string;
use types::{ChatId, GroupPermissionRole, GroupRole, OptionUpdate::*, OptionalGroupPermissions};

#[test]
fn owner_can_promote_to_and_demote_from_owner() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2, group_id } = init_test_data(env, canister_ids, *controller);

    client::group::happy_path::change_role(env, user1.principal, group_id, user2.user_id, GroupRole::Owner);

    let summary1 = client::group::happy_path::summary(env, user2.principal, group_id);
    assert!(matches!(summary1.membership.unwrap().role, GroupRole::Owner));

    client::group::happy_path::change_role(env, user1.principal, group_id, user2.user_id, GroupRole::Admin);

    let summary1 = client::group::happy_path::summary(env, user2.principal, group_id);
    assert!(matches!(summary1.membership.unwrap().role, GroupRole::Admin));
}

#[test]
fn admin_cannot_demote_owner() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2, group_id } = init_test_data(env, canister_ids, *controller);

    client::group::happy_path::change_role(env, user1.principal, group_id, user2.user_id, GroupRole::Admin);

    let response = client::group::change_role(
        env,
        user2.principal,
        group_id.into(),
        &group_canister::change_role::Args {
            user_id: user1.user_id,
            user_ids: vec![user1.user_id],
            new_role: GroupRole::Participant,
        },
    );

    assert!(
        matches!(&response, group_canister::change_role::Response::PartialSuccess(errors) if errors.contains_key(&user1.user_id)),
        "{response:?}",
    );

    let summary = client::group::happy_path::summary(env, user1.principal, group_id);
    assert!(matches!(summary.membership.unwrap().role, GroupRole::Owner));
}

#[test]
fn moderator_cannot_demote_admin() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2, group_id } = init_test_data(env, canister_ids, *controller);

    let user3 = client::register_user(env, canister_ids);
    client::group::happy_path::join_group(env, user3.principal, group_id);
    let user4 = client::register_user(env, canister_ids);
    client::group::happy_path::join_group(env, user4.principal, group_id);

    // Allow moderators to change roles so that only the seniority check can block the demotion
    client::group::happy_path::update_group(
        env,
        user1.principal,
        group_id,
        &group_canister::update_group_v2::Args {
            name: None,
            description: None,
            rules: None,
            avatar: NoChange,
            permissions_v2: Some(OptionalGroupPermissions {
                change_roles: Some(GroupPermissionRole::Moderators),
                ..Default::default()
            }),
            events_ttl: NoChange,
            gate_config: NoChange,
            public: None,
            messages_visible_to_non_members: None,
        },
    );

    client::group::happy_path::change_role(env, user1.principal, group_id, user2.user_id, GroupRole::Moderator);
    client::group::happy_path::change_role(env, user1.principal, group_id, user3.user_id, GroupRole::Admin);

    let response = client::group::change_role(
        env,
        user2.principal,
        group_id.into(),
        &group_canister::change_role::Args {
            user_id: user3.user_id,
            user_ids: vec![user3.user_id],
            new_role: GroupRole::Participant,
        },
    );

    assert!(
        matches!(&response, group_canister::change_role::Response::PartialSuccess(errors) if errors.contains_key(&user3.user_id)),
        "{response:?}",
    );

    let summary = client::group::happy_path::summary(env, user3.principal, group_id);
    assert!(matches!(summary.membership.unwrap().role, GroupRole::Admin));

    // But the moderator can change the role of a regular member
    client::group::happy_path::change_role(env, user2.principal, group_id, user4.user_id, GroupRole::Moderator);
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);

    let group_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user1, &group_name, true, true);
    client::group::happy_path::join_group(env, user2.principal, group_id);

    TestData { user1, user2, group_id }
}

struct TestData {
    user1: User,
    user2: User,
    group_id: ChatId,
}
