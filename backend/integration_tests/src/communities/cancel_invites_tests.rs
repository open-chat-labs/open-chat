use crate::env::ENV;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use itertools::Itertools;
use pocket_ic::PocketIc;
use std::ops::Deref;
use testing::rng::random_string;
use types::CommunityId;

#[test]
fn cancel_invites_succeeds() {
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
        user3,
        community_id,
    } = init_test_data(env, canister_ids, *controller);

    client::local_user_index::happy_path::invite_users_to_community(
        env,
        &user1,
        canister_ids.local_user_index(env, community_id),
        community_id,
        vec![user2.user_id, user3.user_id],
    );

    client::community::happy_path::cancel_invites(env, user1.principal, community_id, vec![user2.user_id], None);

    env.tick();

    let community_details = client::community::happy_path::selected_initial(env, user1.principal, community_id);
    assert_eq!(community_details.invited_users, vec![user3.user_id]);
}

#[test]
fn cancel_channel_invites_succeeds() {
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
        user3,
        community_id,
    } = init_test_data(env, canister_ids, *controller);

    let channel_id = client::community::happy_path::create_channel(env, user1.principal, community_id, false, random_string());

    client::local_user_index::happy_path::invite_users_to_channel(
        env,
        &user1,
        canister_ids.local_user_index(env, community_id),
        community_id,
        channel_id,
        vec![user2.user_id, user3.user_id],
    );

    client::community::happy_path::cancel_invites(env, user1.principal, community_id, vec![user2.user_id], Some(channel_id));

    let community_details = client::community::happy_path::selected_initial(env, user1.principal, community_id);
    assert_eq!(
        community_details.invited_users.into_iter().sorted().collect_vec(),
        vec![user2.user_id, user3.user_id].into_iter().sorted().collect_vec()
    );

    let channel_details = client::community::happy_path::selected_channel_initial(env, &user1, community_id, channel_id);
    assert_eq!(channel_details.invited_users, vec![user3.user_id]);
}

#[test]
fn cancelling_community_invites_cancels_all_channel_invites() {
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
        user3,
        community_id,
    } = init_test_data(env, canister_ids, *controller);

    let channel1_id = client::community::happy_path::create_channel(env, user1.principal, community_id, false, random_string());
    let channel2_id = client::community::happy_path::create_channel(env, user1.principal, community_id, false, random_string());

    client::local_user_index::happy_path::invite_users_to_channel(
        env,
        &user1,
        canister_ids.local_user_index(env, community_id),
        community_id,
        channel1_id,
        vec![user2.user_id, user3.user_id],
    );

    client::local_user_index::happy_path::invite_users_to_channel(
        env,
        &user1,
        canister_ids.local_user_index(env, community_id),
        community_id,
        channel2_id,
        vec![user2.user_id, user3.user_id],
    );

    client::community::happy_path::cancel_invites(env, user1.principal, community_id, vec![user2.user_id], None);

    let community_details = client::community::happy_path::selected_initial(env, user1.principal, community_id);
    assert_eq!(community_details.invited_users, vec![user3.user_id]);

    let channel1_details = client::community::happy_path::selected_channel_initial(env, &user1, community_id, channel1_id);
    assert_eq!(channel1_details.invited_users, vec![user3.user_id]);

    let channel2_details = client::community::happy_path::selected_channel_initial(env, &user1, community_id, channel2_id);
    assert_eq!(channel2_details.invited_users, vec![user3.user_id]);
}

#[test]
fn cancel_invites_not_authorized() {
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
        user3,
        community_id,
    } = init_test_data(env, canister_ids, *controller);

    client::local_user_index::happy_path::invite_users_to_community(
        env,
        &user1,
        canister_ids.local_user_index(env, community_id),
        community_id,
        vec![user2.user_id, user3.user_id],
    );

    client::community::happy_path::join_community(env, user2.principal, community_id);

    let response = client::community::cancel_invites(
        env,
        user2.principal,
        community_id.into(),
        &community_canister::cancel_invites::Args {
            channel_id: None,
            user_ids: vec![user3.user_id],
        },
    );

    assert!(matches!(
        response,
        community_canister::cancel_invites::Response::NotAuthorized
    ));

    let community_details = client::community::happy_path::selected_initial(env, user2.principal, community_id);
    assert_eq!(community_details.invited_users, vec![user3.user_id]);
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);
    let user3 = client::register_user(env, canister_ids);

    let community_name = random_string();

    let community_id = client::user::happy_path::create_community(env, &user1, &community_name, false, vec![random_string()]);

    TestData {
        user1,
        user2,
        user3,
        community_id,
    }
}

struct TestData {
    user1: User,
    user2: User,
    user3: User,
    community_id: CommunityId,
}
