use crate::env::ENV;
use crate::rng::random_string;
use crate::{client, TestEnv, User};
use ic_test_state_machine_client::StateMachine;
use std::ops::Deref;
use types::{CanisterId, ChatId};

#[test]
fn delete_group_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let TestData { user1, user2, group_id } = init_test_data(env, canister_ids.local_user_index);

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

    let initial_state = client::user::happy_path::initial_state(env, &user2);

    assert!(!initial_state.group_chats.iter().any(|c| c.chat_id == group_id));
}

fn init_test_data(env: &mut StateMachine, local_user_index: CanisterId) -> TestData {
    let user1 = client::local_user_index::happy_path::register_user(env, local_user_index);
    let user2 = client::local_user_index::happy_path::register_user(env, local_user_index);

    let group_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user1, &group_name, false, true);
    client::local_user_index::happy_path::add_users_to_group(
        env,
        user1.principal,
        local_user_index,
        group_id,
        vec![(user2.user_id, user2.principal)],
    );

    TestData { user1, user2, group_id }
}

#[allow(dead_code)]
struct TestData {
    user1: User,
    user2: User,
    group_id: ChatId,
}
