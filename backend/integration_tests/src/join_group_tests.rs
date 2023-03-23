use crate::rng::random_string;
use crate::setup::{return_env, setup_env, TestEnv};
use crate::{client, User};
use ic_test_state_machine_client::StateMachine;
use types::{CanisterId, ChatId};

#[test]
fn join_public_group_succeeds() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let TestData {
        user1: _,
        user2,
        group_id,
    } = init_test_data(&mut env, canister_ids.user_index, true);

    client::local_user_index::happy_path::join_group(&mut env, user2.principal, canister_ids.local_user_index, group_id);

    env.tick();

    let initial_state = client::user::happy_path::initial_state_v2(&env, &user2);

    assert!(initial_state.group_chats.iter().any(|c| c.chat_id == group_id));

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}

#[test]
fn join_private_group_using_invite_code_succeeds() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let TestData { user1, user2, group_id } = init_test_data(&mut env, canister_ids.user_index, false);

    let invite_code_response = client::group::enable_invite_code(
        &mut env,
        user1.principal,
        group_id.into(),
        &group_canister::enable_invite_code::Args { correlation_id: 0 },
    );

    let invite_code = if let group_canister::enable_invite_code::Response::Success(result) = invite_code_response {
        result.code
    } else {
        panic!()
    };

    let join_group_response = client::local_user_index::join_group(
        &mut env,
        user2.principal,
        canister_ids.local_user_index,
        &local_user_index_canister::join_group::Args {
            chat_id: group_id,
            invite_code: Some(invite_code),
            correlation_id: 0,
        },
    );

    assert!(
        matches!(
            join_group_response,
            local_user_index_canister::join_group::Response::Success(_)
        ),
        "{join_group_response:?}",
    );

    env.tick();

    let initial_state = client::user::happy_path::initial_state_v2(&env, &user2);

    assert!(initial_state.group_chats.iter().any(|c| c.chat_id == group_id));

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}

fn init_test_data(env: &mut StateMachine, user_index: CanisterId, public: bool) -> TestData {
    let user1 = client::user_index::happy_path::register_user(env, user_index);
    let user2 = client::user_index::happy_path::register_user(env, user_index);

    let group_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user1, &group_name, public, true);

    TestData { user1, user2, group_id }
}

#[allow(dead_code)]
struct TestData {
    user1: User,
    user2: User,
    group_id: ChatId,
}
