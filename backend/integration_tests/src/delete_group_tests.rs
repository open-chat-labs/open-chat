use crate::rng::random_string;
use crate::setup::{return_env, setup_env, TestEnv};
use crate::{client, User};
use ic_test_state_machine_client::StateMachine;
use types::{CanisterId, ChatId};

#[test]
fn delete_group_succeeds() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let TestData { user1, user2, group_id } = init_test_data(&mut env, canister_ids.user_index);

    let delete_group_response = client::user::delete_group(
        &mut env,
        user1.principal,
        user1.canister(),
        &user_canister::delete_group::Args { chat_id: group_id },
    );

    assert!(
        matches!(delete_group_response, user_canister::delete_group::Response::Success),
        "{delete_group_response:?}",
    );

    env.tick();

    let initial_state = client::user::happy_path::initial_state_v2(&env, &user2);

    assert!(!initial_state.group_chats.iter().any(|c| c.chat_id == group_id));

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}

fn init_test_data(env: &mut StateMachine, user_index: CanisterId) -> TestData {
    let user1 = client::user_index::happy_path::register_user(env, user_index);
    let user2 = client::user_index::happy_path::register_user(env, user_index);

    let group_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user1, &group_name, false, true);
    client::group::happy_path::add_participants(env, &user1, group_id, vec![user2.user_id]);

    TestData { user1, user2, group_id }
}

#[allow(dead_code)]
struct TestData {
    user1: User,
    user2: User,
    group_id: ChatId,
}
