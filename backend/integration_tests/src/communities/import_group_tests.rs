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

    assert!(matches!(
        import_group_response,
        community_canister::import_group::Response::Success(_)
    ));

    tick_many(env, 30);

    let expected_channel_names: Vec<_> = default_channels.into_iter().chain([group_name]).sorted().collect();

    let community_summary1 = client::community::happy_path::summary(env, &user1, community_id);
    assert_eq!(
        community_summary1.channels.into_iter().map(|c| c.name).sorted().collect_vec(),
        expected_channel_names
    );

    let community_summary2 = client::community::happy_path::summary(env, &user2, community_id);
    assert_eq!(
        community_summary2.channels.into_iter().map(|c| c.name).sorted().collect_vec(),
        expected_channel_names
    );

    let initial_state1 = client::user::happy_path::initial_state(env, &user1);
    assert!(initial_state1.group_chats.summaries.is_empty());
    assert_eq!(initial_state1.communities.summaries.len(), 1);

    let initial_state2 = client::user::happy_path::initial_state(env, &user2);
    assert!(initial_state2.group_chats.summaries.is_empty());
    assert_eq!(initial_state2.communities.summaries.len(), 1);

    // Check that the group has been deleted
    assert!(!env.canister_exists(group_id.into()));
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
