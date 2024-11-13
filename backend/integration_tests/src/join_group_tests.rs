use crate::env::ENV;
use crate::utils::now_millis;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use testing::rng::random_string;
use types::ChatId;

#[test]
fn join_public_group_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1: _,
        user2,
        group_id,
    } = init_test_data(env, canister_ids, *controller, true);

    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);

    env.tick();

    let initial_state = client::user::happy_path::initial_state(env, &user2);

    assert!(initial_state.group_chats.summaries.iter().any(|c| c.chat_id == group_id));
}

#[test]
fn join_private_group_with_invitation_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2, group_id } = init_test_data(env, canister_ids, *controller, false);

    client::local_user_index::happy_path::invite_users_to_group(
        env,
        &user1,
        canister_ids.local_user_index,
        group_id,
        vec![user2.user_id],
    );

    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);

    env.tick();

    let initial_state = client::user::happy_path::initial_state(env, &user2);

    assert!(initial_state.group_chats.summaries.iter().any(|c| c.chat_id == group_id));
}

#[test]
fn join_private_group_using_invite_code_succeeds() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
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
            verified_credential_args: None,
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

    let initial_state = client::user::happy_path::initial_state(env, &user2);

    assert!(initial_state.group_chats.summaries.iter().any(|c| c.chat_id == group_id));
}

#[test]
fn join_leave_group_triggers_correct_updates() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData {
        user1: _,
        user2,
        group_id,
    } = init_test_data(env, canister_ids, *controller, true);

    env.advance_time(Duration::from_secs(1));

    client::local_user_index::happy_path::join_group(env, user2.principal, canister_ids.local_user_index, group_id);

    env.tick();

    let updates = client::user::happy_path::updates(env, &user2, now_millis(env) - 1);

    assert!(updates.unwrap().group_chats.added.iter().any(|c| c.chat_id == group_id));

    env.advance_time(Duration::from_secs(1));

    client::user::happy_path::leave_group(env, &user2, group_id);

    let updates = client::user::happy_path::updates(env, &user2, now_millis(env) - 1);

    assert!(updates.unwrap().group_chats.removed.contains(&group_id));
}

fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal, public: bool) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);

    let group_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user1, &group_name, public, true);

    TestData { user1, user2, group_id }
}

struct TestData {
    user1: User,
    user2: User,
    group_id: ChatId,
}
