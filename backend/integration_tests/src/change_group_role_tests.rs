use crate::env::ENV;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use testing::rng::random_string;
use types::{ChatId, GroupRole};

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
    assert!(matches!(summary1.role, GroupRole::Owner));

    client::group::happy_path::change_role(env, user1.principal, group_id, user2.user_id, GroupRole::Admin);

    let summary1 = client::group::happy_path::summary(env, user2.principal, group_id);
    assert!(matches!(summary1.role, GroupRole::Admin));
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
