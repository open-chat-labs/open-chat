use crate::client::community::STABLE_MEMORY_MAP_MEMORY_ID;
use crate::env::ENV;
use crate::stable_memory::get_stable_memory_map;
use crate::utils::tick_many;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use chat_events::ChatEventInternal;
use itertools::Itertools;
use pocket_ic::PocketIc;
use stable_memory_map::{ChatEventKeyPrefix, KeyPrefix};
use std::ops::Deref;
use testing::rng::random_string;
use types::{ChatId, EventIndex, EventWrapperInternal, Rules};

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

        let summary1 = client::community::happy_path::summary(env, user1.principal, result.community_id);
        assert_eq!(
            summary1.channels.into_iter().map(|c| c.name).collect_vec(),
            expected_channel_names
        );

        let summary2 = client::community::happy_path::summary(env, user2.principal, result.community_id);
        assert_eq!(
            summary2.channels.into_iter().map(|c| c.name).collect_vec(),
            expected_channel_names
        );

        let selected_initial = client::community::happy_path::selected_initial(env, user1.principal, result.community_id);
        assert_eq!(selected_initial.blocked_users.len(), 1);

        let selected_channel_initial =
            client::community::happy_path::selected_channel_initial(env, &user1, result.community_id, result.channel_id);
        assert!(selected_channel_initial.blocked_users.is_empty());

        let stable_memory_map = get_stable_memory_map(env, result.community_id, STABLE_MEMORY_MAP_MEMORY_ID);
        let key_prefix = ChatEventKeyPrefix::new_from_channel(result.channel_id, None);
        let range_start = key_prefix.create_key(&EventIndex::default());
        let range_end = key_prefix.create_key(&EventIndex::from(u32::MAX));

        let mut latest_event_index = EventIndex::default();
        for event in stable_memory_map
            .values_range(range_start.as_ref().to_vec()..range_end.as_ref().to_vec())
            .map(|bytes| msgpack::deserialize_then_unwrap::<EventWrapperInternal<ChatEventInternal>>(&bytes))
        {
            latest_event_index = event.index;
            assert!(!matches!(event.event, ChatEventInternal::ChatFrozen(_)),);
        }
        assert_eq!(latest_event_index, selected_channel_initial.latest_event_index);
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
    client::group::happy_path::join_group(env, user2.principal, group_id);
    client::group::happy_path::join_group(env, user3.principal, group_id);

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
