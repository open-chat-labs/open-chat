use crate::setup::{return_env, setup_env};
use crate::{client, User};
use candid::Principal;
use ic_state_machine_tests::StateMachine;
use itertools::Itertools;
use std::time::Duration;
use types::{CanisterId, ChatId, UserId};

// zzyk3-openc-hatbo-tq7my-cai
const OPENCHAT_BOT_USER_ID: UserId = UserId::new(Principal::from_slice(&[228, 104, 142, 9, 133, 211, 135, 217, 129, 1]));

#[test]
fn initial_state() {
    let (mut env, canister_ids) = setup_env();

    let TestData {
        user,
        group1: (group1, _),
        group2: (group2, _),
        direct: (user2, ..),
    } = init_test_data(&mut env, canister_ids.user_index);

    let initial_state = client::user::happy_path::initial_state(&env, &user);

    let expected_chat_ids: Vec<_> = [group1, group2, user2.user_id.into(), OPENCHAT_BOT_USER_ID.into()]
        .into_iter()
        .sorted()
        .collect();

    let actual_chat_ids: Vec<_> = initial_state.chats.iter().map(|c| c.chat_id()).sorted().collect();

    assert_eq!(actual_chat_ids, expected_chat_ids);

    return_env(env, canister_ids);
}

#[test]
fn updates_all_updated() {
    let (mut env, canister_ids) = setup_env();

    let TestData {
        user,
        group1: (group1, send_group_result1),
        group2: (group2, send_group_result2),
        direct: (user2, _, send_direct_result2),
    } = init_test_data(&mut env, canister_ids.user_index);

    let updates_args = user_canister::updates::Args {
        updates_since: user_canister::updates::UpdatesSince {
            timestamp: send_direct_result2.timestamp - 1,
            group_chats: vec![
                user_canister::updates::GroupChatUpdatesSince {
                    chat_id: group1,
                    updates_since: send_group_result1.timestamp - 1,
                },
                user_canister::updates::GroupChatUpdatesSince {
                    chat_id: group2,
                    updates_since: send_group_result2.timestamp - 1,
                },
            ],
        },
    };

    let updates_response = client::user::updates(&env, user.principal, user.canister(), &updates_args);
    if let user_canister::updates::Response::Success(r) = updates_response {
        let expected_chat_ids: Vec<_> = [group1, group2, user2.user_id.into()].into_iter().sorted().collect();
        let actual_chat_ids: Vec<_> = r.chats_updated.iter().map(|c| c.chat_id()).sorted().collect();

        assert_eq!(actual_chat_ids, expected_chat_ids);
        assert!(r.chats_added.is_empty());
    } else {
        panic!("Updates returned an error: {updates_response:?}");
    }

    return_env(env, canister_ids);
}

#[test]
fn updates_some_updated() {
    let (mut env, canister_ids) = setup_env();

    let TestData {
        user,
        group1: (group1, send_group_result1),
        group2: (group2, send_group_result2),
        direct: (user2, send_direct_result1, ..),
    } = init_test_data(&mut env, canister_ids.user_index);

    let updates_args = user_canister::updates::Args {
        updates_since: user_canister::updates::UpdatesSince {
            timestamp: send_direct_result1.timestamp,
            group_chats: vec![
                user_canister::updates::GroupChatUpdatesSince {
                    chat_id: group1,
                    updates_since: send_group_result1.timestamp - 1,
                },
                user_canister::updates::GroupChatUpdatesSince {
                    chat_id: group2,
                    updates_since: send_group_result2.timestamp,
                },
            ],
        },
    };

    let updates_response = client::user::updates(&env, user.principal, user.canister(), &updates_args);
    if let user_canister::updates::Response::Success(r) = updates_response {
        let expected_chat_ids: Vec<_> = [group1, user2.user_id.into()].into_iter().sorted().collect();
        let actual_chat_ids: Vec<_> = r.chats_updated.iter().map(|c| c.chat_id()).sorted().collect();

        assert_eq!(actual_chat_ids, expected_chat_ids);
        assert!(r.chats_added.is_empty());
    } else {
        panic!("Updates returned an error: {updates_response:?}");
    }

    return_env(env, canister_ids);
}

#[test]
fn updates_none_updated() {
    let (mut env, canister_ids) = setup_env();

    let TestData {
        user,
        group1: (group1, send_group_result1),
        group2: (group2, send_group_result2),
        direct: (.., send_direct_result2),
    } = init_test_data(&mut env, canister_ids.user_index);

    let updates_args = user_canister::updates::Args {
        updates_since: user_canister::updates::UpdatesSince {
            timestamp: send_direct_result2.timestamp,
            group_chats: vec![
                user_canister::updates::GroupChatUpdatesSince {
                    chat_id: group1,
                    updates_since: send_group_result1.timestamp,
                },
                user_canister::updates::GroupChatUpdatesSince {
                    chat_id: group2,
                    updates_since: send_group_result2.timestamp,
                },
            ],
        },
    };

    let updates_response = client::user::updates(&env, user.principal, user.canister(), &updates_args);
    if let user_canister::updates::Response::Success(r) = updates_response {
        assert!(r.chats_added.is_empty());
        assert!(r.chats_updated.is_empty());
    } else {
        panic!("Updates returned an error: {updates_response:?}");
    }

    return_env(env, canister_ids);
}

#[test]
fn updates_all_chats_added() {
    let (mut env, canister_ids) = setup_env();

    let TestData {
        user,
        group1: (group1, _),
        group2: (group2, _),
        direct: (user2, send_direct_result1, _),
    } = init_test_data(&mut env, canister_ids.user_index);

    let updates_args = user_canister::updates::Args {
        updates_since: user_canister::updates::UpdatesSince {
            timestamp: send_direct_result1.timestamp - 1,
            group_chats: Vec::new(),
        },
    };

    let updates_response = client::user::updates(&env, user.principal, user.canister(), &updates_args);
    if let user_canister::updates::Response::Success(r) = updates_response {
        let expected_chat_ids: Vec<_> = [group1, group2, user2.user_id.into()].into_iter().sorted().collect();
        let actual_chat_ids: Vec<_> = r.chats_added.iter().map(|c| c.chat_id()).sorted().collect();

        assert_eq!(actual_chat_ids, expected_chat_ids);
        assert!(r.chats_updated.is_empty());
    } else {
        panic!("Updates returned an error: {updates_response:?}");
    }

    return_env(env, canister_ids);
}

#[test]
fn updates_some_chats_added() {
    let (mut env, canister_ids) = setup_env();

    let TestData {
        user,
        group1: (group1, send_group_result1),
        group2: (group2, _),
        direct: (.., send_direct_result2),
    } = init_test_data(&mut env, canister_ids.user_index);

    let updates_args = user_canister::updates::Args {
        updates_since: user_canister::updates::UpdatesSince {
            timestamp: send_direct_result2.timestamp,
            group_chats: vec![user_canister::updates::GroupChatUpdatesSince {
                chat_id: group1,
                updates_since: send_group_result1.timestamp,
            }],
        },
    };

    let updates_response = client::user::updates(&env, user.principal, user.canister(), &updates_args);
    if let user_canister::updates::Response::Success(r) = updates_response {
        let expected_chat_ids: Vec<_> = vec![group2];
        let actual_chat_ids: Vec<_> = r.chats_added.iter().map(|c| c.chat_id()).sorted().collect();

        assert_eq!(actual_chat_ids, expected_chat_ids);
        assert!(r.chats_updated.is_empty());
    } else {
        panic!("Updates returned an error: {updates_response:?}");
    }

    return_env(env, canister_ids);
}

fn init_test_data(env: &mut StateMachine, user_index: CanisterId) -> TestData {
    let one_second = Duration::from_secs(1);

    let user1 = client::user_index::happy_path::register_user(env, user_index);
    env.advance_time(one_second);
    let user2 = client::user_index::happy_path::register_user(env, user_index);
    env.advance_time(one_second);

    let group1 = client::user::happy_path::create_group(env, &user1, "TEST_NAME1", false, false);
    client::group::happy_path::add_participants(env, &user1, group1, vec![user2.user_id]);
    let send_group_result1 = client::group::happy_path::send_text_message(env, &user2, group1, "3");
    env.advance_time(one_second);

    let group2 = client::user::happy_path::create_group(env, &user1, "TEST_NAME2", false, false);
    client::group::happy_path::add_participants(env, &user1, group2, vec![user2.user_id]);
    let send_group_result2 = client::group::happy_path::send_text_message(env, &user2, group2, "4");
    env.advance_time(one_second);

    let send_direct_result1 = client::user::happy_path::send_text_message(env, &user2, user1.user_id, "1");
    env.advance_time(one_second);
    let send_direct_result2 = client::user::happy_path::send_text_message(env, &user2, user1.user_id, "2");
    env.advance_time(one_second);

    TestData {
        user: user1,
        group1: (group1, send_group_result1),
        group2: (group2, send_group_result2),
        direct: (user2, send_direct_result1, send_direct_result2),
    }
}

struct TestData {
    user: User,
    direct: (
        User,
        user_canister::send_message::SuccessResult,
        user_canister::send_message::SuccessResult,
    ),
    group1: (ChatId, group_canister::send_message::SuccessResult),
    group2: (ChatId, group_canister::send_message::SuccessResult),
}
