use crate::env::ENV;
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use testing::rng::random_string;
use types::{ChannelId, CommunityId, MessageIndex};

#[test]
fn search_channel_returns_expected_message() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        user2: _,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    let response = client::community::search_channel(
        env,
        user1.principal,
        community_id.into(),
        &community_canister::search_channel::Args {
            channel_id,
            search_term: "crue".to_string(),
            max_results: 10,
            users: None,
        },
    );

    let matches = match response {
        community_canister::search_channel::Response::Success(result) => result.matches,
        response => panic!("'search_channel' error: {response:?}"),
    };

    assert_eq!(matches.len(), 1);
    assert_eq!(matches[0].message_index, MessageIndex::from(1));
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);
    let community_id =
        client::user::happy_path::create_community(env, &user1, &random_string(), true, vec!["general".to_string()]);
    client::community::happy_path::join_community(env, user2.principal, community_id);

    env.tick();

    let summary = client::community::happy_path::summary(env, user2.principal, community_id);
    let channel_id = summary.channels.iter().find(|c| c.name == "general").unwrap().channel_id;

    client::community::happy_path::send_text_message(env, &user1, community_id, channel_id, None, "Hello, world!", None);
    client::community::happy_path::send_text_message(
        env,
        &user2,
        community_id,
        channel_id,
        None,
        "Goodbye, cruel world!",
        None,
    );

    TestData {
        user1,
        user2,
        community_id,
        channel_id,
    }
}

#[expect(dead_code)]
struct TestData {
    user1: User,
    user2: User,
    community_id: CommunityId,
    channel_id: ChannelId,
}
