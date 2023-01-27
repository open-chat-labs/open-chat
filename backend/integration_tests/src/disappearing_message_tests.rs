use crate::rng::random_string;
use crate::setup::{return_env, setup_env, TestEnv};
use crate::{client, User};
use ic_state_machine_tests::StateMachine;
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

    let send_message_response1 = client::group::happy_path::send_text_message(&mut env, &user1, group_id, "abc", None);

    assert!(
        client::group::happy_path::events_by_index(&env, &user1, group_id, vec![send_message_response1.event_index])
            .events
            .first()
            .is_some()
    );

    env.advance_time(Duration::from_millis(2000));

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

    let send_message_response2 = client::group::happy_path::send_text_message(&mut env, &user1, group_id, "xyz", None);

    env.advance_time(Duration::from_secs(100000));

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
