use crate::env::ENV;
use crate::rng::random_string;
use crate::{client, TestEnv, User};
use ic_test_state_machine_client::StateMachine;
use std::ops::Deref;
use std::time::Duration;
use types::{CanisterId, ChatId};

#[test]
fn delete_group_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let TestData { user1, group_id, .. } = init_test_data(env, canister_ids.local_user_index);

    let delete_group_response = client::user::delete_group(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::delete_group::Args { chat_id: group_id },
    );

    assert!(
        matches!(delete_group_response, user_canister::delete_group::Response::Success),
        "{delete_group_response:?}",
    );

    env.tick();

    assert!(!env.canister_exists(group_id.into()));
}

#[test]
fn user_canister_notified_of_group_deleted() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let TestData {
        user1,
        user2,
        user3,
        group_id,
    } = init_test_data(env, canister_ids.local_user_index);

    env.stop_canister(user2.canister(), Some(canister_ids.local_user_index))
        .unwrap();

    env.stop_canister(user3.canister(), Some(canister_ids.local_user_index))
        .unwrap();

    let delete_group_response = client::user::delete_group(
        env,
        user1.principal,
        user1.canister(),
        &user_canister::delete_group::Args { chat_id: group_id },
    );

    assert!(
        matches!(delete_group_response, user_canister::delete_group::Response::Success),
        "{delete_group_response:?}",
    );

    env.tick();

    let initial_state1 = client::user::happy_path::initial_state(env, &user1);
    assert!(!initial_state1.group_chats.summaries.iter().any(|c| c.chat_id == group_id));

    env.advance_time(Duration::from_secs(9 * 60));

    env.tick();

    env.start_canister(user2.user_id.into(), Some(canister_ids.local_user_index))
        .unwrap();

    env.tick();

    let initial_state2 = client::user::happy_path::initial_state(env, &user1);
    assert!(!initial_state2.group_chats.summaries.iter().any(|c| c.chat_id == group_id));

    env.advance_time(Duration::from_secs(2 * 60));

    env.tick();

    env.start_canister(user3.user_id.into(), Some(canister_ids.local_user_index))
        .unwrap();

    env.tick();

    // Only retry for 10 minutes so the notification shouldn't have made it to user3's canister
    let initial_state3 = client::user::happy_path::initial_state(env, &user1);
    assert!(initial_state3.group_chats.summaries.iter().any(|c| c.chat_id == group_id));
}

fn init_test_data(env: &mut StateMachine, local_user_index: CanisterId) -> TestData {
    let user1 = client::local_user_index::happy_path::register_user(env, local_user_index);
    let user2 = client::local_user_index::happy_path::register_user(env, local_user_index);
    let user3 = client::local_user_index::happy_path::register_user(env, local_user_index);

    let group_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user1, &group_name, false, true);
    client::local_user_index::happy_path::add_users_to_group(
        env,
        user1.principal,
        local_user_index,
        group_id,
        vec![(user2.user_id, user2.principal), (user3.user_id, user3.principal)],
    );

    TestData {
        user1,
        user2,
        user3,
        group_id,
    }
}

#[allow(dead_code)]
struct TestData {
    user1: User,
    user2: User,
    user3: User,
    group_id: ChatId,
}
