use crate::env::ENV;
use crate::rng::random_string;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use ic_test_state_machine_client::StateMachine;
use itertools::Itertools;
use std::ops::Deref;
use std::time::Duration;
use types::{ChatId, OptionUpdate};

#[test]
fn disappearing_messages_in_group_chats() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { user, group_id } = init_test_data(env, canister_ids, *controller, true);

    client::group::update_group_v2(
        env,
        user.principal,
        group_id.into(),
        &group_canister::update_group_v2::Args {
            events_ttl: OptionUpdate::SetToSome(1000),
            ..Default::default()
        },
    );

    let send_message_response1 = client::group::happy_path::send_text_message(env, &user, group_id, None, "abc", None);

    assert!(
        client::group::happy_path::events_by_index(env, &user, group_id, vec![send_message_response1.event_index])
            .events
            .first()
            .is_some()
    );

    env.advance_time(Duration::from_millis(2000));
    env.tick();

    assert!(
        client::group::happy_path::events_by_index(env, &user, group_id, vec![send_message_response1.event_index])
            .events
            .first()
            .is_none()
    );

    client::group::update_group_v2(
        env,
        user.principal,
        group_id.into(),
        &group_canister::update_group_v2::Args {
            events_ttl: OptionUpdate::SetToNone,
            ..Default::default()
        },
    );

    let send_message_response2 = client::group::happy_path::send_text_message(env, &user, group_id, None, "xyz", None);

    env.advance_time(Duration::from_secs(100000));
    env.tick();

    assert!(
        client::group::happy_path::events_by_index(env, &user, group_id, vec![send_message_response2.event_index])
            .events
            .first()
            .is_some()
    );
}

#[test]
fn group_chat_summary_contains_expired_messages() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { user, group_id } = init_test_data(env, canister_ids, *controller, true);

    client::group::update_group_v2(
        env,
        user.principal,
        group_id.into(),
        &group_canister::update_group_v2::Args {
            events_ttl: OptionUpdate::SetToSome(1000),
            ..Default::default()
        },
    );

    let send_message_response1 = client::group::happy_path::send_text_message(env, &user, group_id, None, "abc", None);
    env.advance_time(Duration::from_millis(400));
    let send_message_response2 = client::group::happy_path::send_text_message(env, &user, group_id, None, "def", None);
    env.advance_time(Duration::from_millis(400));
    let send_message_response3 = client::group::happy_path::send_text_message(env, &user, group_id, None, "ghi", None);
    env.advance_time(Duration::from_millis(400));
    let send_message_response4 = client::group::happy_path::send_text_message(env, &user, group_id, None, "jkl", None);
    env.advance_time(Duration::from_millis(400));
    let send_message_response5 = client::group::happy_path::send_text_message(env, &user, group_id, None, "mno", None);
    env.advance_time(Duration::from_millis(400));
    let send_message_response6 = client::group::happy_path::send_text_message(env, &user, group_id, None, "mno", None);

    let summary = client::group::happy_path::summary(env, &user, group_id);
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
        env,
        user.principal,
        group_id.into(),
        &group_canister::update_group_v2::Args {
            events_ttl: OptionUpdate::SetToSome(2000),
            ..Default::default()
        },
    );
    let send_message_response7 = client::group::happy_path::send_text_message(env, &user, group_id, None, "pqr", None);
    let summary_updates = client::group::happy_path::summary_updates(env, &user, group_id, summary_timestamp).unwrap();

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
}

fn init_test_data(env: &mut StateMachine, canister_ids: &CanisterIds, controller: Principal, public: bool) -> TestData {
    let user = client::register_diamond_user(env, canister_ids, controller);

    let group_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user, &group_name, public, true);

    TestData { user, group_id }
}

#[allow(dead_code)]
struct TestData {
    user: User,
    group_id: ChatId,
}
