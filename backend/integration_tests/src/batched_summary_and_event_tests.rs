use crate::env::ENV;
use crate::utils::now_millis;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use local_user_index_canister::chat_events::{EventsArgs, EventsArgsInner, EventsByIndexArgs, EventsContext, EventsResponse};
use local_user_index_canister::group_and_community_summary_updates::{SummaryUpdatesArgs, SummaryUpdatesResponse};
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::{CanisterId, ChannelId, ChatEvent, ChatId, CommunityId};

#[test]
fn get_batched_events_succeeds() {
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

    let local_user_index_canister::chat_events::Response::Success(result) = client::local_user_index::chat_events(
        env,
        user1.principal,
        canister_ids.local_user_index(env, user1.canister()),
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

    assert_is_message_with_text(result.responses.first().unwrap(), "User: 0");
    assert_is_message_with_text(result.responses.get(1).unwrap(), "Group1: 1");
    assert_is_message_with_text(result.responses.get(2).unwrap(), "Group2: 2");
    assert_is_message_with_text(result.responses.get(3).unwrap(), "Channel: 3");
}

#[test]
fn get_batched_summaries_succeeds() {
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

    let start = now_millis(env);

    let local_user_index = canister_ids.local_user_index(env, user1.canister());

    let local_user_index_canister::group_and_community_summary_updates::Response::Success(responses) =
        client::local_user_index::group_and_community_summary_updates(
            env,
            user1.principal,
            local_user_index,
            &local_user_index_canister::group_and_community_summary_updates::Args {
                requests: vec![
                    SummaryUpdatesArgs {
                        canister_id: group_id1.into(),
                        is_community: false,
                        invite_code: None,
                        updates_since: None,
                    },
                    SummaryUpdatesArgs {
                        canister_id: group_id2.into(),
                        is_community: false,
                        invite_code: None,
                        updates_since: None,
                    },
                    SummaryUpdatesArgs {
                        canister_id: community_id.into(),
                        is_community: true,
                        invite_code: None,
                        updates_since: None,
                    },
                ],
            },
        );

    assert_is_summary_with_id(responses.first().unwrap(), group_id1.into(), false);
    assert_is_summary_with_id(responses.get(1).unwrap(), group_id2.into(), false);
    assert_is_summary_with_id(responses.get(2).unwrap(), community_id.into(), true);

    env.advance_time(Duration::from_secs(1));

    client::user::happy_path::send_text_message(env, &user1, user2.user_id, random_string(), None);
    client::group::happy_path::send_text_message(env, &user1, group_id1, None, random_string(), None);
    client::community::happy_path::send_text_message(env, &user1, community_id, channel_id, None, random_string(), None);

    let local_user_index_canister::group_and_community_summary_updates::Response::Success(responses) =
        client::local_user_index::group_and_community_summary_updates(
            env,
            user1.principal,
            local_user_index,
            &local_user_index_canister::group_and_community_summary_updates::Args {
                requests: vec![
                    SummaryUpdatesArgs {
                        canister_id: group_id1.into(),
                        is_community: false,
                        invite_code: None,
                        updates_since: Some(start + 1),
                    },
                    SummaryUpdatesArgs {
                        canister_id: group_id2.into(),
                        is_community: false,
                        invite_code: None,
                        updates_since: Some(start + 1),
                    },
                    SummaryUpdatesArgs {
                        canister_id: community_id.into(),
                        is_community: true,
                        invite_code: None,
                        updates_since: Some(start + 1),
                    },
                ],
            },
        );

    assert_is_summary_updates_with_id(responses.first().unwrap(), group_id1.into(), false);
    assert!(matches!(responses.get(1).unwrap(), SummaryUpdatesResponse::SuccessNoUpdates));
    assert_is_summary_updates_with_id(responses.get(2).unwrap(), community_id.into(), true);
}

fn assert_is_message_with_text(response: &EventsResponse, text: &str) {
    if let EventsResponse::Success(result) = response {
        assert_eq!(result.events.len(), 1);
        if let ChatEvent::Message(message) = &result.events.first().unwrap().event {
            assert_eq!(message.content.text().unwrap(), text);
            return;
        }
    }
    panic!("{response:?}")
}

fn assert_is_summary_with_id(response: &SummaryUpdatesResponse, canister_id: CanisterId, is_community: bool) {
    match response {
        SummaryUpdatesResponse::SuccessCommunity(c) if is_community => {
            assert_eq!(CanisterId::from(c.community_id), canister_id)
        }
        SummaryUpdatesResponse::SuccessGroup(c) if !is_community => assert_eq!(CanisterId::from(c.chat_id), canister_id),
        _ => panic!(),
    }
}

fn assert_is_summary_updates_with_id(response: &SummaryUpdatesResponse, canister_id: CanisterId, is_community: bool) {
    match response {
        SummaryUpdatesResponse::SuccessCommunityUpdates(c) if is_community => {
            assert_eq!(CanisterId::from(c.community_id), canister_id)
        }
        SummaryUpdatesResponse::SuccessGroupUpdates(c) if !is_community => assert_eq!(CanisterId::from(c.chat_id), canister_id),
        _ => panic!(),
    }
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);

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
