use crate::env::ENV;
use crate::rng::random_string;
use crate::utils::tick_many;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use ic_test_state_machine_client::StateMachine;
use std::ops::Deref;
use types::ChatId;

#[test]
fn remove_group_member_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { user1, user2, group_id } = init_test_data(env, canister_ids, *controller, true);

    let remove_member_response = client::group::remove_participant(
        env,
        user1.principal,
        group_id.into(),
        &group_canister::remove_participant::Args {
            user_id: user2.user_id,
            correlation_id: 0,
        },
    );

    assert!(matches!(
        remove_member_response,
        group_canister::remove_participant::Response::Success
    ));

    let members = client::group::happy_path::selected_initial(env, &user1, group_id).participants;

    assert!(!members.iter().any(|m| m.user_id == user2.user_id));
}

#[test]
fn block_user_who_is_no_longer_group_member_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let TestData { user1, user2, group_id } = init_test_data(env, canister_ids, *controller, true);

    client::user::happy_path::leave_group(env, &user2, group_id);

    let block_user_response = client::group::block_user(
        env,
        user1.principal,
        group_id.into(),
        &group_canister::block_user::Args {
            user_id: user2.user_id,
            correlation_id: 0,
        },
    );

    assert!(matches!(block_user_response, group_canister::block_user::Response::Success));

    let blocked_users = client::group::happy_path::selected_initial(env, &user1, group_id).blocked_users;

    assert!(blocked_users.contains(&user2.user_id));

    let join_group_response = client::local_user_index::join_group(
        env,
        user2.principal,
        canister_ids.local_user_index,
        &local_user_index_canister::join_group::Args {
            chat_id: group_id,
            invite_code: None,
            correlation_id: 0,
        },
    );

    assert!(matches!(
        join_group_response,
        local_user_index_canister::join_group::Response::Blocked
    ));
}

fn init_test_data(env: &mut StateMachine, canister_ids: &CanisterIds, controller: Principal, public: bool) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    let group_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user1, &group_name, public, true);

    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);

    tick_many(env, 3);

    TestData { user1, user2, group_id }
}

#[allow(dead_code)]
struct TestData {
    user1: User,
    user2: User,
    group_id: ChatId,
}
