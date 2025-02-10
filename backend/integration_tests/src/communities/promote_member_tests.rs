use crate::env::ENV;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::{CommunityId, CommunityRole};

#[test]
fn promote_member_to_admin() {
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
    } = init_test_data(env, canister_ids, *controller);

    let summary = client::community::happy_path::summary(env, user2.principal, community_id);

    env.advance_time(Duration::from_millis(1000));

    client::community::happy_path::change_role(env, user1.principal, community_id, user2.user_id, CommunityRole::Admin);

    let selected_initial = client::community::happy_path::selected_initial(env, user2.principal, community_id);

    assert_eq!(
        selected_initial
            .members
            .iter()
            .find(|m| m.user_id == user2.user_id)
            .unwrap()
            .role,
        CommunityRole::Admin
    );

    let Some(updates) =
        client::community::happy_path::selected_updates(env, user1.principal, community_id, summary.last_updated)
    else {
        panic!("Expected member to be updated");
    };

    assert_eq!(updates.members_added_or_updated.len(), 1);
    assert_eq!(updates.members_added_or_updated[0].role, CommunityRole::Admin);
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);

    let user2 = client::register_user(env, canister_ids);

    let community_id =
        client::user::happy_path::create_community(env, &user1, &random_string(), true, vec!["general".to_string()]);

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
