use crate::env::ENV;
use crate::rng::random_string;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use local_user_index_canister::chat_events::{EventsArgs, EventsArgsInner, EventsByIndexArgs, EventsContext};
use pocket_ic::PocketIc;
use std::ops::Deref;
use types::{ChannelId, ChatEvent, ChatId, CommunityId};

#[test]
fn send_message_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData {
        user1,
        user2,
        group_id1,
        group_id2,
        community_id,
        channel_id,
    } = init_test_data(env, canister_ids, *controller);

    for i in 0..5 {
        client::user::happy_path::send_text_message(env, &user1, user2.user_id, format!("User: {i}"), None);
        client::group::happy_path::send_text_message(env, &user1, group_id1, None, format!("Group1: {i}"), None);
        client::group::happy_path::send_text_message(env, &user1, group_id2, None, format!("Group2: {i}"), None);
        client::community::happy_path::send_text_message(
            env,
            &user1,
            community_id,
            channel_id,
            None,
            format!("Channel: {i}"),
            None,
        );
    }

    let local_user_index_canister::chat_events::Response::Success(responses) = client::local_user_index::chat_events(
        env,
        user1.principal,
        canister_ids.local_user_index,
        &local_user_index_canister::chat_events::Args {
            requests: vec![
                EventsArgs {
                    context: EventsContext::Direct(user2.user_id),
                    args: EventsArgsInner::ByIndex(EventsByIndexArgs { events: vec![1.into()] }),
                    latest_known_update: None,
                },
                EventsArgs {
                    context: EventsContext::Group(group_id1, None),
                    args: EventsArgsInner::ByIndex(EventsByIndexArgs { events: vec![2.into()] }),
                    latest_known_update: None,
                },
                EventsArgs {
                    context: EventsContext::Group(group_id2, None),
                    args: EventsArgsInner::ByIndex(EventsByIndexArgs { events: vec![3.into()] }),
                    latest_known_update: None,
                },
                EventsArgs {
                    context: EventsContext::Channel(community_id, channel_id, None),
                    args: EventsArgsInner::ByIndex(EventsByIndexArgs { events: vec![4.into()] }),
                    latest_known_update: None,
                },
            ],
        },
    );

    assert_is_message_with_text(responses.get(0).unwrap(), "User: 0");
    assert_is_message_with_text(responses.get(1).unwrap(), "Group1: 1");
    assert_is_message_with_text(responses.get(2).unwrap(), "Group2: 2");
    assert_is_message_with_text(responses.get(3).unwrap(), "Channel: 3");
}

fn assert_is_message_with_text(response: &local_user_index_canister::chat_events::EventsResponse, text: &str) {
    if let local_user_index_canister::chat_events::EventsResponse::Success(result) = response {
        assert_eq!(result.events.len(), 1);
        if let ChatEvent::Message(message) = &result.events.first().unwrap().event {
            assert_eq!(message.content.text().unwrap(), text);
            return;
        }
    }
    panic!("{response:?}")
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let group_id1 = client::user::happy_path::create_group(env, &user1, &random_string(), true, true);
    let group_id2 = client::user::happy_path::create_group(env, &user1, &random_string(), true, true);
    let community_id = client::user::happy_path::create_community(env, &user1, &random_string(), true, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string());

    TestData {
        user1,
        user2,
        group_id1,
        group_id2,
        community_id,
        channel_id,
    }
}

struct TestData {
    user1: User,
    user2: User,
    group_id1: ChatId,
    group_id2: ChatId,
    community_id: CommunityId,
    channel_id: ChannelId,
}
