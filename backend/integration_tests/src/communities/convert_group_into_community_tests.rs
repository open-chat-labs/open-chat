use crate::env::ENV;
use crate::rng::random_string;
use crate::utils::tick_many;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use ic_test_state_machine_client::StateMachine;
use itertools::Itertools;
use std::ops::Deref;
use types::{AccessRules, ChatId};

#[test]
fn import_group_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        group_id,
        group_name,
    } = init_test_data(env, canister_ids, *controller);

    for i in 1..10 {
        let text = i.to_string().as_str().repeat(500);

        client::group::happy_path::send_text_message(env, &user1, group_id, None, text, None);
    }

    let convert_to_community_response = client::group::convert_to_community(
        env,
        user1.principal,
        group_id.into(),
        &group_canister::convert_to_community::Args {
            rules: AccessRules::default(),
            permissions: None,
            history_visible_to_new_joiners: true,
        },
    );

    if let group_canister::convert_to_community::Response::Success(community_id) = convert_to_community_response {
        tick_many(env, 20);

        let expected_channel_names = vec![group_name];

        let summary1 = client::community::happy_path::summary(env, &user1, community_id);
        assert_eq!(
            summary1.channels.into_iter().map(|c| c.name).sorted().collect_vec(),
            expected_channel_names
        );

        let summary2 = client::community::happy_path::summary(env, &user2, community_id);
        assert_eq!(
            summary2.channels.into_iter().map(|c| c.name).sorted().collect_vec(),
            expected_channel_names
        );
    } else {
        panic!("'convert_to_community' error: {convert_to_community_response:?}");
    }
}

fn init_test_data(env: &mut StateMachine, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let group_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user1, &group_name, true, true);
    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);

    tick_many(env, 3);

    TestData {
        user1,
        user2,
        group_id,
        group_name,
    }
}

struct TestData {
    user1: User,
    user2: User,
    group_id: ChatId,
    group_name: String,
}
