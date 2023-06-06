use crate::env::ENV;
use crate::rng::random_string;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use ic_test_state_machine_client::StateMachine;
use itertools::Itertools;
use std::ops::Deref;
use test_case::test_case;
use types::CommunityId;

#[test]
fn users_automatically_joined_to_default_channels() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let default_channels: Vec<_> = (0..5).map(|_| random_string()).sorted().collect();

    let TestData { user, community_id } = init_test_data(env, canister_ids, *controller, true, default_channels.clone());

    let summary1 = client::community::happy_path::summary(env, &user, community_id);

    assert_eq!(summary1.channels.len(), default_channels.len());
    assert_eq!(
        summary1.channels.into_iter().map(|c| c.name).sorted().collect_vec(),
        default_channels
    );

    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    client::local_user_index::happy_path::join_community(env, user2.principal, canister_ids.local_user_index, community_id);
    env.tick();

    let summary2 = client::community::happy_path::summary(env, &user2, community_id);

    assert_eq!(summary2.channels.len(), default_channels.len());
    assert_eq!(
        summary2.channels.into_iter().map(|c| c.name).sorted().collect_vec(),
        default_channels
    );
}

#[test_case(true)]
#[test_case(false)]
fn create_channel_succeeds(is_public: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let default_channels = vec![random_string()];

    let TestData { user, community_id } = init_test_data(env, canister_ids, *controller, true, default_channels.clone());

    let channel_name = random_string();
    let channel_id =
        client::community::happy_path::create_channel(env, user.principal, community_id, is_public, channel_name.clone());

    let summary = client::community::happy_path::summary(env, &user, community_id);

    assert_eq!(summary.channels.len(), default_channels.len() + 1);
    assert!(summary
        .channels
        .iter()
        .any(|c| c.channel_id == channel_id && c.is_public == is_public && c.name == channel_name));
}

fn init_test_data(
    env: &mut StateMachine,
    canister_ids: &CanisterIds,
    controller: Principal,
    public: bool,
    default_channels: Vec<String>,
) -> TestData {
    let user = client::register_diamond_user(env, canister_ids, controller);
    let community_name = random_string();
    let community_id = client::user::happy_path::create_community(env, &user, &community_name, public, default_channels);

    env.tick();

    TestData { user, community_id }
}

#[allow(dead_code)]
struct TestData {
    user: User,
    community_id: CommunityId,
}
