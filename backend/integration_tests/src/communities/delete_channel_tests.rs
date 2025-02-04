use crate::client::community::STABLE_MEMORY_MAP_MEMORY_ID;
use crate::env::ENV;
use crate::stable_memory::get_stable_memory_map;
use crate::utils::now_millis;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::random_string;
use types::{ChannelId, CommunityId};

#[test_case(true)]
#[test_case(false)]
fn delete_channel_succeeds(as_owner: bool) {
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
        channel_id1,
        ..
    } = init_test_data(env, canister_ids, *controller);

    let start = now_millis(env);
    env.advance_time(Duration::from_secs(1));

    let response = client::community::delete_channel(
        env,
        if as_owner { user1.principal } else { user2.principal },
        community_id.into(),
        &community_canister::delete_channel::Args { channel_id: channel_id1 },
    );
    if as_owner {
        assert!(matches!(response, community_canister::delete_channel::Response::Success));
    } else {
        assert!(matches!(
            response,
            community_canister::delete_channel::Response::NotAuthorized
        ));
    }

    let summary = client::community::happy_path::summary(env, user1.principal, community_id);
    assert_ne!(summary.channels.iter().any(|c| c.channel_id == channel_id1), as_owner);

    let summary_updates = client::community::happy_path::summary_updates(env, user1.principal, community_id, start);
    if as_owner {
        assert!(summary_updates
            .unwrap()
            .channels_removed
            .first()
            .is_some_and(|c| *c == channel_id1));
    } else {
        assert!(summary_updates.is_none());
    }
}

#[test]
fn stable_memory_garbage_collected_after_deleting_channel() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1,
        community_id,
        channel_id1,
        channel_id2,
        ..
    } = init_test_data(env, canister_ids, *controller);

    let initial_stable_memory_map_keys = get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_MEMORY_ID).len();

    for _ in 0..100 {
        client::community::happy_path::send_text_message(env, &user1, community_id, channel_id1, None, random_string(), None);
    }

    assert_eq!(
        get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_MEMORY_ID).len(),
        initial_stable_memory_map_keys + 100
    );

    for _ in 0..80 {
        client::community::happy_path::send_text_message(env, &user1, community_id, channel_id2, None, random_string(), None);
    }

    assert_eq!(
        get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_MEMORY_ID).len(),
        initial_stable_memory_map_keys + 180
    );

    client::community::happy_path::delete_channel(env, user1.principal, community_id, channel_id1);

    env.advance_time(Duration::from_secs(60));
    env.tick();

    assert_eq!(
        get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_MEMORY_ID).len(),
        initial_stable_memory_map_keys + 77
    );

    client::community::happy_path::delete_channel(env, user1.principal, community_id, channel_id2);

    env.advance_time(Duration::from_secs(60));
    env.tick();

    assert_eq!(
        get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_MEMORY_ID).len(),
        initial_stable_memory_map_keys - 6
    );
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);
    let community_name = random_string();
    let community_id =
        client::user::happy_path::create_community(env, &user1, &community_name, true, vec![random_string(), random_string()]);
    let summary = client::community::happy_path::join_community(env, user2.principal, community_id);
    let channel_id1 = summary.channels.first().unwrap().channel_id;
    let channel_id2 = summary.channels.last().unwrap().channel_id;

    env.tick();

    TestData {
        user1,
        user2,
        community_id,
        channel_id1,
        channel_id2,
    }
}

struct TestData {
    user1: User,
    user2: User,
    community_id: CommunityId,
    channel_id1: ChannelId,
    channel_id2: ChannelId,
}
