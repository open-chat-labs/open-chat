use crate::env::ENV;
use crate::utils::now_millis;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::{ChannelId, CommunityId};

#[test]
fn create_user_group_succeeds() {
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
        ..
    } = init_test_data(env, canister_ids, *controller);

    let user_group_name = random_string();
    let response = client::community::create_user_group(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::create_user_group::Args {
            name: user_group_name.clone(),
            user_ids: vec![user1.user_id, user2.user_id, user3.user_id],
        },
    );

    let user_group_id = if let community_canister::create_user_group::Response::Success(result) = response {
        result.user_group_id
    } else {
        panic!("'create_user_group' error: {response:?}");
    };

    assert!(user_group_id > 0);

    let summary = client::community::happy_path::summary(env, user1.principal, community_id);
    assert_eq!(summary.user_groups.len(), 1);

    let user_group = summary.user_groups.first().unwrap();
    assert_eq!(user_group.user_group_id, user_group_id);
    assert_eq!(user_group.name, user_group_name);
    assert_eq!(user_group.members, 3);

    let details = client::community::happy_path::selected_initial(env, user1.principal, community_id);
    assert_eq!(details.user_groups.len(), 1);

    let user_groups = details.user_groups.first().unwrap();
    assert_eq!(user_groups.members.len(), 3);
}

#[test]
fn update_user_group_succeeds() {
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
        ..
    } = init_test_data(env, canister_ids, *controller);

    let user_group_name = random_string();
    let response = client::community::create_user_group(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::create_user_group::Args {
            name: user_group_name.clone(),
            user_ids: vec![user1.user_id, user2.user_id],
        },
    );

    let user_group_id = if let community_canister::create_user_group::Response::Success(result) = response {
        result.user_group_id
    } else {
        panic!("'create_user_group' error: {response:?}");
    };

    let new_name = random_string();

    let update_response = client::community::update_user_group(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::update_user_group::Args {
            user_group_id,
            name: Some(new_name.clone()),
            users_to_add: vec![user3.user_id],
            users_to_remove: vec![user2.user_id],
        },
    );

    assert!(matches!(
        update_response,
        community_canister::update_user_group::Response::Success
    ));

    let summary = client::community::happy_path::summary(env, user1.principal, community_id);
    assert_eq!(summary.user_groups.len(), 1);

    let user_group = summary.user_groups.first().unwrap();
    assert_eq!(user_group.user_group_id, user_group_id);
    assert_eq!(user_group.name, new_name);
    assert_eq!(user_group.members, 2);

    let details = client::community::happy_path::selected_initial(env, user1.principal, community_id);
    assert_eq!(details.user_groups.len(), 1);

    let user_groups = details.user_groups.first().unwrap();
    assert_eq!(user_groups.members.len(), 2);
    assert!(user_groups.members.contains(&user1.user_id));
    assert!(user_groups.members.contains(&user3.user_id));
}

#[test]
fn delete_user_group_succeeds() {
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
        ..
    } = init_test_data(env, canister_ids, *controller);

    let user_group_name = random_string();
    let response = client::community::create_user_group(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::create_user_group::Args {
            name: user_group_name.clone(),
            user_ids: vec![user1.user_id, user2.user_id],
        },
    );

    let user_group_id = if let community_canister::create_user_group::Response::Success(result) = response {
        result.user_group_id
    } else {
        panic!("'create_user_group' error: {response:?}");
    };

    env.advance_time(Duration::from_secs(60));

    let delete_response = client::community::delete_user_groups(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::delete_user_groups::Args {
            user_group_ids: vec![user_group_id],
        },
    );

    assert!(matches!(
        delete_response,
        community_canister::delete_user_groups::Response::Success
    ));

    let summary = client::community::happy_path::summary(env, user1.principal, community_id);
    assert!(summary.user_groups.is_empty());

    let summary_updates =
        client::community::happy_path::summary_updates(env, user1.principal, community_id, now_millis(env) - 1);
    assert_eq!(summary_updates.unwrap().user_groups_deleted, vec![user_group_id]);
}

#[test]
fn send_message_mentioning_user_group() {
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
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    let user_group_name = random_string();
    let user_group_id = client::community::happy_path::create_user_group(
        env,
        user1.principal,
        community_id,
        user_group_name.clone(),
        vec![user1.user_id, user2.user_id],
    );

    let text = format!("Hello @UserGroup({user_group_id})!");

    let send_message_result =
        client::community::happy_path::send_text_message(env, &user3, community_id, channel_id, None, text, None);

    let user1_channel_summary = client::community::happy_path::channel_summary(env, &user1, community_id, channel_id);
    let user1_mentions = user1_channel_summary.membership.unwrap().mentions;
    assert_eq!(user1_mentions.len(), 1);
    assert_eq!(
        user1_mentions.first().unwrap().message_index,
        send_message_result.message_index
    );

    let user2_channel_summary = client::community::happy_path::channel_summary(env, &user2, community_id, channel_id);
    let user2_mentions = user2_channel_summary.membership.unwrap().mentions;
    assert_eq!(user2_mentions.len(), 1);
    assert_eq!(
        user2_mentions.first().unwrap().message_index,
        send_message_result.message_index
    );
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);
    let user3 = client::register_user(env, canister_ids);

    let community_id =
        client::user::happy_path::create_community(env, &user1, &random_string(), true, vec!["general".to_string()]);

    client::local_user_index::happy_path::join_community(
        env,
        user2.principal,
        canister_ids.local_user_index(env, community_id),
        community_id,
        None,
    );
    client::local_user_index::happy_path::join_community(
        env,
        user3.principal,
        canister_ids.local_user_index(env, community_id),
        community_id,
        None,
    );

    let summary = client::community::happy_path::summary(env, user1.principal, community_id);

    TestData {
        user1,
        user2,
        user3,
        community_id,
        channel_id: summary.channels.first().unwrap().channel_id,
    }
}

struct TestData {
    user1: User,
    user2: User,
    user3: User,
    community_id: CommunityId,
    channel_id: ChannelId,
}
