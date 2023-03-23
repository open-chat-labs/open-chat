use crate::rng::random_string;
use crate::setup::{return_env, setup_env, TestEnv};
use crate::utils::tick_many;
use crate::{client, User};
use candid::Principal;
use group_index_canister::freeze_group::SuspensionDetails;
use ic_test_state_machine_client::StateMachine;
use std::time::Duration;
use types::{CanisterId, ChatId};
use utils::time::DAY_IN_MS;

#[test]
fn freeze_then_unfreeze() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let TestData { user1, group_id, .. } = init_test_data(&mut env, canister_ids.user_index, controller);

    client::group_index::freeze_group(
        &mut env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::freeze_group::Args {
            chat_id: group_id,
            reason: None,
            suspend_members: None,
        },
    );

    let summary_args = group_canister::public_summary::Args { invite_code: None };

    if let group_canister::public_summary::Response::Success(res) =
        client::group::public_summary(&env, user1.principal, group_id.into(), &summary_args)
    {
        assert!(res.summary.frozen.is_some());
    } else {
        panic!()
    }

    client::group_index::unfreeze_group(
        &mut env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::unfreeze_group::Args { chat_id: group_id },
    );

    if let group_canister::public_summary::Response::Success(res) =
        client::group::public_summary(&env, user1.principal, group_id.into(), &summary_args)
    {
        assert!(res.summary.frozen.is_none());
    } else {
        panic!()
    }

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}

#[test]
fn can_only_be_called_by_platform_moderator() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let TestData {
        user1, user2, group_id, ..
    } = init_test_data(&mut env, canister_ids.user_index, controller);

    let freeze_args = group_index_canister::freeze_group::Args {
        chat_id: group_id,
        reason: None,
        suspend_members: None,
    };

    let response1 = client::group_index::freeze_group(&mut env, user2.principal, canister_ids.group_index, &freeze_args);
    assert!(matches!(
        response1,
        group_index_canister::freeze_group::Response::NotAuthorized
    ));

    let response2 = client::group_index::freeze_group(&mut env, user1.principal, canister_ids.group_index, &freeze_args);
    assert!(
        matches!(response2, group_index_canister::freeze_group::Response::Success(_)),
        "{response2:#?}",
    );

    let unfreeze_args = group_index_canister::unfreeze_group::Args { chat_id: group_id };

    let response3 = client::group_index::unfreeze_group(&mut env, user2.principal, canister_ids.group_index, &unfreeze_args);
    assert!(matches!(
        response3,
        group_index_canister::unfreeze_group::Response::NotAuthorized
    ));

    let response4 = client::group_index::unfreeze_group(&mut env, user1.principal, canister_ids.group_index, &unfreeze_args);
    assert!(matches!(
        response4,
        group_index_canister::unfreeze_group::Response::Success(_)
    ));

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}

#[test]
fn search_excludes_frozen_groups() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let TestData {
        user1,
        user2,
        group_id,
        group_name,
    } = init_test_data(&mut env, canister_ids.user_index, controller);

    let search_args = group_index_canister::search::Args {
        search_term: group_name,
        max_results: 10,
    };

    if let group_index_canister::search::Response::Success(res) =
        client::group_index::search(&env, user2.principal, canister_ids.group_index, &search_args)
    {
        assert_eq!(res.matches.len(), 1);
    } else {
        panic!()
    }

    client::group_index::freeze_group(
        &mut env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::freeze_group::Args {
            chat_id: group_id,
            reason: None,
            suspend_members: None,
        },
    );

    if let group_index_canister::search::Response::Success(res) =
        client::group_index::search(&env, user2.principal, canister_ids.group_index, &search_args)
    {
        assert!(res.matches.is_empty());
    } else {
        panic!()
    }

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}

#[test]
fn freeze_and_suspend_users() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let TestData {
        user1, user2, group_id, ..
    } = init_test_data(&mut env, canister_ids.user_index, controller);

    client::group_index::freeze_group(
        &mut env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::freeze_group::Args {
            chat_id: group_id,
            reason: None,
            suspend_members: Some(SuspensionDetails {
                duration: None,
                reason: "spam".to_string(),
            }),
        },
    );

    env.tick();

    let user = client::user_index::happy_path::current_user(&env, user2.principal, canister_ids.user_index);

    assert!(user.suspension_details.is_some());

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}

#[test]
fn delete_frozen_group() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let TestData { user1, group_id, .. } = init_test_data(&mut env, canister_ids.user_index, controller);

    client::group_index::freeze_group(
        &mut env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::freeze_group::Args {
            chat_id: group_id,
            reason: None,
            suspend_members: None,
        },
    );

    env.advance_time(Duration::from_millis(7 * DAY_IN_MS));

    let delete_group_response1 = client::group_index::delete_frozen_group(
        &mut env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::delete_frozen_group::Args { chat_id: group_id },
    );
    assert!(
        matches!(
            delete_group_response1,
            group_index_canister::delete_frozen_group::Response::ChatNotFrozenLongEnough(_)
        ),
        "{delete_group_response1:?}"
    );

    env.advance_time(Duration::from_millis(1));

    let delete_group_response2 = client::group_index::delete_frozen_group(
        &mut env,
        user1.principal,
        canister_ids.group_index,
        &group_index_canister::delete_frozen_group::Args { chat_id: group_id },
    );
    assert!(
        matches!(
            delete_group_response2,
            group_index_canister::delete_frozen_group::Response::Success
        ),
        "{delete_group_response2:?}"
    );

    tick_many(&mut env, 5);

    assert!(!env.canister_exists(Principal::from(group_id).as_slice().try_into().unwrap()));

    return_env(TestEnv {
        env,
        canister_ids,
        controller,
    });
}

fn init_test_data(env: &mut StateMachine, user_index: CanisterId, controller: Principal) -> TestData {
    let user1 = client::user_index::happy_path::register_user(env, user_index);
    let user2 = client::user_index::happy_path::register_user(env, user_index);

    client::user_index::add_platform_moderator(
        env,
        controller,
        user_index,
        &user_index_canister::add_platform_moderator::Args { user_id: user1.user_id },
    );

    let group_name = random_string();

    let group_id = client::user::happy_path::create_group(env, &user2, &group_name, true, true);

    TestData {
        user1,
        user2,
        group_id,
        group_name,
    }
}

struct TestData {
    user1: User,
    user2: User,
    group_id: ChatId,
    group_name: String,
}
