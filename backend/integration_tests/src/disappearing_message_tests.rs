use crate::rng::random_string;
use crate::setup::{return_env, setup_env, TestEnv};
use crate::{client, User};
use ic_state_machine_tests::StateMachine;
use itertools::Itertools;
use std::time::Duration;
use types::{CanisterId, ChatId, OptionUpdate};

#[test]
fn disappearing_messages_in_group_chats() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let TestData { user1, group_id } = init_test_data(&mut env, canister_ids.user_index, true);

    client::group::update_group_v2(
        &mut env,
        user1.principal,
        group_id.into(),
        &group_canister::update_group_v2::Args {
            events_ttl: OptionUpdate::SetToSome(1000),
            ..Default::default()
        },
    );

    let send_message_response1 = client::group::happy_path::send_text_message(&mut env, &user1, group_id, None, "abc", None);

    assert!(
        client::group::happy_path::events_by_index(&env, &user1, group_id, vec![send_message_response1.event_index])
            .events
            .first()
            .is_some()
    );

    env.advance_time(Duration::from_millis(2000));
    env.tick();

    assert!(
        client::group::happy_path::events_by_index(&env, &user1, group_id, vec![send_message_response1.event_index])
            .events
            .first()
            .is_none()
    );

    client::group::update_group_v2(
        &mut env,
        user1.principal,
        group_id.into(),
        &group_canister::update_group_v2::Args {
            events_ttl: OptionUpdate::SetToNone,
            ..Default::default()
        },
    );

    let send_message_response2 = client::group::happy_path::send_text_message(&mut env, &user1, group_id, None, "xyz", None);

    env.advance_time(Duration::from_secs(100000));
    env.tick();

    assert!(
        client::group::happy_path::events_by_index(&env, &user1, group_id, vec![send_message_response2.event_index])
            .events
            .first()
            .is_some()
    );

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}

#[test]
fn group_chat_summary_contains_expired_messages() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let TestData { user1, group_id } = init_test_data(&mut env, canister_ids.user_index, true);

    client::group::update_group_v2(
        &mut env,
        user1.principal,
        group_id.into(),
        &group_canister::update_group_v2::Args {
            events_ttl: OptionUpdate::SetToSome(1000),
            ..Default::default()
        },
    );

    let send_message_response1 = client::group::happy_path::send_text_message(&mut env, &user1, group_id, None, "abc", None);
    env.advance_time(Duration::from_millis(400));
    let send_message_response2 = client::group::happy_path::send_text_message(&mut env, &user1, group_id, None, "def", None);
    env.advance_time(Duration::from_millis(400));
    let send_message_response3 = client::group::happy_path::send_text_message(&mut env, &user1, group_id, None, "ghi", None);
    env.advance_time(Duration::from_millis(400));
    let send_message_response4 = client::group::happy_path::send_text_message(&mut env, &user1, group_id, None, "jkl", None);
    env.advance_time(Duration::from_millis(400));
    let send_message_response5 = client::group::happy_path::send_text_message(&mut env, &user1, group_id, None, "mno", None);
    env.advance_time(Duration::from_millis(400));
    let send_message_response6 = client::group::happy_path::send_text_message(&mut env, &user1, group_id, None, "mno", None);

    let summary = client::group::happy_path::summary(&env, &user1, group_id);
    let summary_timestamp = send_message_response6.timestamp;

    assert_eq!(summary.events_ttl, Some(1000));
    assert_eq!(
        summary.expired_messages.iter().collect_vec(),
        vec![
            send_message_response1.message_index,
            send_message_response2.message_index,
            send_message_response3.message_index
        ]
    );
    assert_eq!(summary.next_message_expiry, send_message_response4.expires_at);

    env.advance_time(Duration::from_millis(2000));

    client::group::update_group_v2(
        &mut env,
        user1.principal,
        group_id.into(),
        &group_canister::update_group_v2::Args {
            events_ttl: OptionUpdate::SetToSome(2000),
            ..Default::default()
        },
    );
    let send_message_response7 = client::group::happy_path::send_text_message(&mut env, &user1, group_id, None, "pqr", None);
    let summary_updates = client::group::happy_path::summary_updates(&env, &user1, group_id, summary_timestamp).unwrap();

    assert_eq!(summary_updates.events_ttl.expand(), Some(Some(2000)));
    assert_eq!(
        summary_updates.newly_expired_messages.iter().collect_vec(),
        vec![
            send_message_response4.message_index,
            send_message_response5.message_index,
            send_message_response6.message_index
        ]
    );
    assert_eq!(
        summary_updates.next_message_expiry.expand(),
        Some(send_message_response7.expires_at)
    );

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}

fn init_test_data(env: &mut StateMachine, user_index: CanisterId, public: bool) -> TestData {
    let user1 = client::user_index::happy_path::register_user(env, user_index);

    let group_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user1, &group_name, public, true);

    TestData { user1, group_id }
}

#[allow(dead_code)]
struct TestData {
    user1: User,
    group_id: ChatId,
}
