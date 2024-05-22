use crate::env::ENV;
use crate::utils::tick_many;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use testing::rng::random_string;
use types::{Chat, ChatEvent, ChatId, MessageContent, MultiUserChat};

#[test]
fn new_platform_moderators_added_to_moderators_group() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1: _,
        user2,
        moderators_group,
    } = init_test_data(env, canister_ids, *controller);

    client::user_index::add_platform_moderator(
        env,
        *controller,
        canister_ids.user_index,
        &user_index_canister::add_platform_moderator::Args { user_id: user2.user_id },
    );

    tick_many(env, 5);

    let initial_state = client::user::happy_path::initial_state(env, &user2);

    assert!(initial_state
        .group_chats
        .summaries
        .iter()
        .any(|c| c.chat_id == moderators_group));
}

#[test]
fn report_message_succeeds() {
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
        moderators_group,
    } = init_test_data(env, canister_ids, *controller);

    let group_id = client::user::happy_path::create_group(env, &user2, &random_string(), true, true);

    client::local_user_index::report_message_v2(
        env,
        user2.principal,
        canister_ids.local_user_index,
        &local_user_index_canister::report_message_v2::Args {
            chat_id: MultiUserChat::Group(group_id),
            thread_root_message_index: None,
            event_index: 10.into(),
            reason_code: 1,
            notes: Some("abc".to_string()),
        },
    );

    let events_response = client::group::events(
        env,
        user1.principal,
        moderators_group.into(),
        &group_canister::events::Args {
            thread_root_message_index: None,
            start_index: 0.into(),
            ascending: true,
            max_messages: 10,
            max_events: 10,
            latest_known_update: None,
        },
    );
    let mut success = false;
    if let group_canister::events::Response::Success(mut e) = events_response {
        let last_event = e.events.pop().unwrap().event;
        if let ChatEvent::Message(m) = last_event {
            assert_eq!(
                m.replies_to.as_ref().unwrap().chat_if_other,
                Some((Chat::Group(group_id), None))
            );
            assert_eq!(m.replies_to.as_ref().unwrap().event_index, 10.into());
            if let MessageContent::ReportedMessage(r) = m.content {
                assert_eq!(r.reports.len(), 1);
                assert_eq!(r.reports[0].reported_by, user2.user_id);
                assert_eq!(r.reports[0].reason_code, 1);
                assert_eq!(r.reports[0].notes, Some("abc".to_string()));
                success = true;
            }
        }
    }

    if !success {
        panic!();
    }
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_diamond_user(env, canister_ids, controller);

    client::user_index::add_platform_moderator(
        env,
        controller,
        canister_ids.user_index,
        &user_index_canister::add_platform_moderator::Args { user_id: user1.user_id },
    );

    let group_name = random_string();
    let group_id = client::user::happy_path::create_group(env, &user1, &group_name, false, true);

    let moderators_group = match client::user_index::assign_platform_moderators_group(
        env,
        controller,
        canister_ids.user_index,
        &user_index_canister::assign_platform_moderators_group::Args { group_id },
    ) {
        user_index_canister::assign_platform_moderators_group::Response::Success => group_id,
        user_index_canister::assign_platform_moderators_group::Response::AlreadySet(id) => id,
    };

    TestData {
        user1,
        user2,
        moderators_group,
    }
}

struct TestData {
    user1: User,
    user2: User,
    moderators_group: ChatId,
}
