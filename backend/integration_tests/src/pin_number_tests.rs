use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::rng::{random_message_id, random_string};
use crate::utils::{now_nanos, tick_many};
use crate::{client, env, TestEnv};
use ledger_utils::create_pending_transaction;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use types::{ChatEvent, CryptoContent, CryptoTransaction, Cryptocurrency, MessageContent, MessageContentInitial};
use utils::time::MINUTE_IN_MS;

#[test]
fn can_set_pin_number() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    client::user::happy_path::set_pin_number(env, &user, None, Some(vec![1, 0, 0, 0]));

    let initial_state = client::user::happy_path::initial_state(env, &user);

    assert!(initial_state.pin_number_settings.enabled);
    assert!(initial_state.pin_number_settings.attempts_blocked_until.is_none());

    client::user::happy_path::set_pin_number(env, &user, Some(vec![1, 0, 0, 0]), Some(vec![1, 0, 0, 1]));

    client::user::happy_path::set_pin_number(env, &user, Some(vec![1, 0, 0, 1]), None);

    assert!(!initial_state.pin_number_settings.enabled);
}

#[test]
fn attempts_blocked_after_incorrect_attempts() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    client::user::happy_path::set_pin_number(env, &user, None, Some(vec![1, 0, 0, 0]));

    for i in 1..4 {
        let response = client::user::set_pin_number(
            env,
            user.principal,
            user.canister(),
            &user_canister::set_pin_number::Args {
                current: Some(vec![1, 0, 0, i]),
                new: Some(vec![2, 0, 0, 0]),
            },
        );

        if i <= 3 {
            assert!(matches!(
                response,
                user_canister::set_pin_number::Response::PinIncorrect(None)
            ));
        } else {
            assert!(matches!(
                response,
                user_canister::set_pin_number::Response::TooManyFailedPinAttempts(_)
            ));
        }
    }

    let initial_state = client::user::happy_path::initial_state(env, &user);

    assert!(initial_state.pin_number_settings.attempts_blocked_until.is_some());

    env.advance_time(Duration::from_millis(5 * MINUTE_IN_MS));

    client::user::happy_path::set_pin_number(env, &user, Some(vec![1, 0, 0, 0]), Some(vec![1, 0, 0, 1]));

    let initial_state = client::user::happy_path::initial_state(env, &user);

    assert!(initial_state.pin_number_settings.attempts_blocked_until.is_none());
}

#[test_case(1; "Correct PIN")]
#[test_case(2; "Incorrect PIN")]
#[test_case(3; "No PIN provided")]
fn transfer_requires_correct_pin(test_case: u32) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    let user2 = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    client::user::happy_path::set_pin_number(env, &user1, None, Some(vec![1, 0, 0, 0]));

    // Send user1 some ICP
    client::icrc1::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user1.user_id, 1_000_000_000);

    let response = client::user::send_message_v2(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id: random_message_id(),
            content: MessageContentInitial::Crypto(CryptoContent {
                recipient: user2.user_id,
                transfer: CryptoTransaction::Pending(create_pending_transaction(
                    Cryptocurrency::InternetComputer,
                    canister_ids.icp_ledger,
                    10000,
                    10000,
                    user2.user_id,
                    None,
                    now_nanos(env),
                )),
                caption: None,
            }),
            replies_to: None,
            forwarding: false,
            message_filter_failed: None,
            pin_attempt: match test_case {
                1 => Some(vec![1, 0, 0, 0]),
                2 => Some(vec![2, 0, 0, 0]),
                3 => None,
                _ => unreachable!(),
            },
            correlation_id: 0,
        },
    );

    match test_case {
        1 => assert!(matches!(response, user_canister::send_message_v2::Response::Success(_))),
        2 => assert!(matches!(response, user_canister::send_message_v2::Response::PinIncorrect(_))),
        3 => assert!(matches!(response, user_canister::send_message_v2::Response::PinRequired)),
        _ => unreachable!(),
    }
}
