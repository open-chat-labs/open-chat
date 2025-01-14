use crate::env::ENV;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use testing::rng::random_string;
use types::CommunityId;

#[test]
fn remove_member_from_channel_succeeds() {
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

    let channel_id = client::community::happy_path::create_channel(env, user1.principal, community_id, false, random_string());

    client::local_user_index::happy_path::invite_users_to_channel(
        env,
        &user1,
        canister_ids.local_user_index(env, community_id),
        community_id,
        channel_id,
        vec![user2.user_id],
    );

    client::community::happy_path::join_channel(env, user2.principal, community_id, channel_id);

    let user2_summary1 = client::community::happy_path::summary(env, user2.principal, community_id);
    assert!(user2_summary1.channels.iter().any(|c| c.channel_id == channel_id));

    let remove_member_response = client::community::remove_member_from_channel(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::remove_member_from_channel::Args {
            channel_id,
            user_id: user2.user_id,
        },
    );

    assert!(matches!(
        remove_member_response,
        community_canister::remove_member_from_channel::Response::Success
    ));

    // Check that the channel is no longer returned for user2
    let user2_summary2 = client::community::happy_path::summary(env, user2.principal, community_id);
    assert!(!user2_summary2.channels.iter().any(|c| c.channel_id == channel_id));

    // Check that the channel is still returned for user1
    let user1_summary = client::community::happy_path::summary(env, user1.principal, community_id);
    assert!(user1_summary.channels.iter().any(|c| c.channel_id == channel_id));
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);

    let community_name = random_string();

    let community_id =
        client::user::happy_path::create_community(env, &user1, &community_name, true, vec!["abcde".to_string()]);

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
