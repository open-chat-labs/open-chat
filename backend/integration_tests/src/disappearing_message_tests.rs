use crate::env::ENV;
use crate::rng::random_string;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use ic_test_state_machine_client::StateMachine;
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
        ..
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

fn init_test_data(env: &mut StateMachine, canister_ids: &CanisterIds, controller: Principal, public: bool) -> TestData {
    let user = client::register_diamond_user(env, canister_ids, controller);

    let group_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user, &group_name, public, true);

    TestData { user, group_id }
}

struct TestData {
    user: User,
    group_id: ChatId,
}
