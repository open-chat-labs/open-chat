use crate::env::ENV;
use crate::rng::random_string;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use ic_test_state_machine_client::StateMachine;
use std::ops::Deref;
use types::ChatId;

#[test]
fn join_public_group_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData {
        user1: _,
        user2,
        group_id,
    } = init_test_data(env, canister_ids, *controller, true);

    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);

    env.tick();

    let initial_state = client::user::happy_path::initial_state_v2(env, &user2);

    assert!(initial_state.group_chats.iter().any(|c| c.chat_id == group_id));
}

#[test]
fn join_private_group_using_invite_code_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { user1, user2, group_id } = init_test_data(env, canister_ids, *controller, false);

    let invite_code_response = client::group::enable_invite_code(
        env,
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
        env,
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

    let initial_state = client::user::happy_path::initial_state_v2(env, &user2);

    assert!(initial_state.group_chats.iter().any(|c| c.chat_id == group_id));
}

fn init_test_data(env: &mut StateMachine, canister_ids: &CanisterIds, controller: Principal, public: bool) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

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
