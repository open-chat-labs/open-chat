use crate::env::ENV;
use crate::rng::random_string;
use crate::utils::tick_many;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use itertools::Itertools;
use pocket_ic::PocketIc;
use std::ops::Deref;
use types::{ChatId, Rules};

#[test]
fn convert_into_community_succeeds() {
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
        group_id,
        group_name,
    } = init_test_data(env, canister_ids, *controller);

    client::group::happy_path::block_user(env, user1.principal, group_id, user3.user_id);

    for i in 1..10 {
        let text = i.to_string().as_str().repeat(500);

        client::group::happy_path::send_text_message(env, &user1, group_id, None, text, None);
    }

    let convert_into_community_response = client::group::convert_into_community(
        env,
        user1.principal,
        group_id.into(),
        &group_canister::convert_into_community::Args {
            rules: Rules::default(),
            permissions: None,
            primary_language: None,
            history_visible_to_new_joiners: true,
        },
    );

    if let group_canister::convert_into_community::Response::Success(result) = convert_into_community_response {
        tick_many(env, 20);

        let expected_channel_names = vec![group_name];

        let summary1 = client::community::happy_path::summary(env, &user1, result.community_id);
        assert_eq!(
            summary1.channels.into_iter().map(|c| c.name).collect_vec(),
            expected_channel_names
        );

        let summary2 = client::community::happy_path::summary(env, &user2, result.community_id);
        assert_eq!(
            summary2.channels.into_iter().map(|c| c.name).collect_vec(),
            expected_channel_names
        );

        let selected_initial = client::community::happy_path::selected_initial(env, &user1, result.community_id);
        assert_eq!(selected_initial.blocked_users.len(), 1);

        let selected_channel_initial =
            client::community::happy_path::selected_channel_initial(env, &user1, result.community_id, result.channel_id);
        assert!(selected_channel_initial.blocked_users.is_empty());
    } else {
        panic!("'convert_into_community' error: {convert_into_community_response:?}");
    }
}

#[test]
fn not_group_owner_returns_unauthorized() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user2, group_id, .. } = init_test_data(env, canister_ids, *controller);

    let convert_into_community_response = client::group::convert_into_community(
        env,
        user2.principal,
        group_id.into(),
        &group_canister::convert_into_community::Args {
            rules: Rules::default(),
            permissions: None,
            history_visible_to_new_joiners: true,
            primary_language: None,
        },
    );

    assert!(matches!(
        convert_into_community_response,
        group_canister::convert_into_community::Response::NotAuthorized
    ));
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);
    let user3 = client::register_user(env, canister_ids);

    let group_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user1, &group_name, true, true);
    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);
    client::local_user_index::happy_path::join_group(env, user3.principal, canister_ids.local_user_index, group_id);

    tick_many(env, 3);

    TestData {
        user1,
        user2,
        user3,
        group_id,
        group_name,
    }
}

struct TestData {
    user1: User,
    user2: User,
    user3: User,
    group_id: ChatId,
    group_name: String,
}
