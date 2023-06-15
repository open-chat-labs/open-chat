use crate::env::ENV;
use crate::rng::random_string;
use crate::utils::tick_many;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use ic_test_state_machine_client::StateMachine;
use itertools::Itertools;
use std::ops::Deref;
use types::{ChatId, CommunityId};

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
        community_id,
        default_channels,
    } = init_test_data(env, canister_ids, *controller);

    for i in 1..10 {
        let text = i.to_string().as_str().repeat(500);

        client::group::happy_path::send_text_message(env, &user1, group_id, None, text, None);
    }

    let import_group_response = client::community::import_group(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::import_group::Args { group_id },
    );

    if let community_canister::import_group::Response::Success(_) = import_group_response {
        tick_many(env, 20);

        let expected_channel_names: Vec<_> = default_channels.into_iter().chain([group_name]).sorted().collect();

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
        panic!("'import_group' error: {import_group_response:?}");
    }
}

fn init_test_data(env: &mut StateMachine, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let group_name = random_string();
    let community_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user1, &group_name, true, true);
    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);

    let default_channels: Vec<_> = (1..5).map(|_| random_string()).collect();

    let community_id = client::user::happy_path::create_community(env, &user1, &community_name, true, default_channels.clone());

    tick_many(env, 3);

    TestData {
        user1,
        user2,
        group_id,
        group_name,
        community_id,
        default_channels,
    }
}

struct TestData {
    user1: User,
    user2: User,
    group_id: ChatId,
    group_name: String,
    community_id: CommunityId,
    default_channels: Vec<String>,
}
