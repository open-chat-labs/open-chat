use crate::client::community::STABLE_MEMORY_MAP_MEMORY_ID;
use crate::env::ENV;
use crate::stable_memory::{STABLE_MEMORY_MAP_SMALL_ENTRIES_MEMORY_ID, get_stable_memory_map};
use crate::utils::tick_many;
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use chat_events::{ChatEventInternal, ChatMetricsInternal};
use constants::DAY_IN_MS;
use itertools::Itertools;
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use stable_memory_map::{ChatEventKeyPrefix, ExpiringEventKeyPrefix, KeyPrefix, MessageIdKeyPrefix, UserMetricsKeyPrefix};
use std::ops::Deref;
use std::time::Duration;
use testing::rng::{random_from_u128, random_string};
use types::{
    ChannelId, Chat, ChatId, CommunityId, EventIndex, EventWrapperInternal, MAX_EVENT_INDEX, MIN_EVENT_INDEX, MessageId,
    OptionUpdate, Rules,
};

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

    let mut messages_sent: Vec<(MessageId, EventIndex)> = Vec::new();
    for i in 1..10 {
        let text = i.to_string().as_str().repeat(500);
        let message_id = random_from_u128();

        let send_result = client::group::happy_path::send_text_message(env, &user1, group_id, None, text, Some(message_id));
        messages_sent.push((message_id, send_result.event_index));
    }

    let group_summary = client::group::happy_path::summary(env, user1.principal, group_id);
    assert_eq!(group_summary.membership.unwrap().my_metrics.text_messages, 9);

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
        // The users' metrics should have been carried over from the group
        assert_eq!(summary1.channels[0].membership.as_ref().unwrap().my_metrics.text_messages, 9);
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

        // The message ids should have been written to stable memory as the events were imported
        let small_entries_map = get_stable_memory_map(env, result.community_id, STABLE_MEMORY_MAP_SMALL_ENTRIES_MEMORY_ID);
        let message_id_prefix = MessageIdKeyPrefix::new_from_chat(Chat::Channel(result.community_id, result.channel_id), None);
        for (message_id, event_index) in messages_sent.iter() {
            let key = message_id_prefix.create_key(message_id);
            assert_eq!(
                small_entries_map.get(&key.as_ref().to_vec()),
                Some(u32::from(*event_index).to_be_bytes().to_vec())
            );
        }

        // The users' metrics should have been moved into stable memory under the channel's prefix
        let user_metrics_key = UserMetricsKeyPrefix::new_from_chat(Chat::Channel(result.community_id, result.channel_id))
            .create_key(&user1.user_id);
        let user_metrics =
            ChatMetricsInternal::from_bytes(&small_entries_map.get(&user_metrics_key.as_ref().to_vec()).unwrap());
        assert_eq!(user_metrics.hydrate().text_messages, 9);

        // Looking up an imported message by its id should succeed
        client::community::happy_path::add_reaction(
            env,
            &user2,
            result.community_id,
            result.channel_id,
            "👍",
            messages_sent[0].0,
        );
    } else {
        panic!("'convert_into_community' error: {convert_into_community_response:?}");
    }
}

#[test]
fn disappearing_messages_still_expire_after_conversion() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, group_id, .. } = init_test_data(env, canister_ids, *controller);

    client::group::update_group_v2(
        env,
        user1.principal,
        group_id.into(),
        &group_canister::update_group_v2::Args {
            events_ttl: OptionUpdate::SetToSome(DAY_IN_MS),
            ..Default::default()
        },
    );

    let event_indexes: Vec<_> = (0..5)
        .map(|_| client::group::happy_path::send_text_message(env, &user1, group_id, None, random_string(), None).event_index)
        .collect();

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

    let group_canister::convert_into_community::Response::Success(result) = convert_into_community_response else {
        panic!("'convert_into_community' error: {convert_into_community_response:?}");
    };
    tick_many(env, 20);

    // The expiring events should have been written to stable memory as the events were imported
    assert_eq!(
        expiring_event_indexes(env, result.community_id, result.channel_id),
        event_indexes
    );

    // Nothing schedules the expiry job when a group is imported, so send a message to schedule it
    client::community::happy_path::send_text_message(
        env,
        &user1,
        result.community_id,
        result.channel_id,
        None,
        random_string(),
        None,
    );

    env.advance_time(Duration::from_millis(DAY_IN_MS));
    env.tick();

    assert!(
        client::community::happy_path::events_by_index(env, &user1, result.community_id, result.channel_id, event_indexes)
            .events
            .is_empty()
    );
    assert!(expiring_event_indexes(env, result.community_id, result.channel_id).is_empty());
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
        group_canister::convert_into_community::Response::Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)
    ));
}

fn expiring_event_indexes(env: &PocketIc, community_id: CommunityId, channel_id: ChannelId) -> Vec<EventIndex> {
    let small_entries_map = get_stable_memory_map(env, community_id, STABLE_MEMORY_MAP_SMALL_ENTRIES_MEMORY_ID);
    let prefix = ExpiringEventKeyPrefix::new_from_chat(Chat::Channel(community_id, channel_id));
    let range_start = prefix.create_key(&(u64::MIN, MIN_EVENT_INDEX));
    let range_end = prefix.create_key(&(u64::MAX, MAX_EVENT_INDEX));

    small_entries_map
        .keys_range(range_start.as_ref().to_vec()..=range_end.as_ref().to_vec())
        .map(|key| u32::from_be_bytes(key[key.len() - 4..].try_into().unwrap()).into())
        .collect()
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
