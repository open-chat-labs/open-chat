use crate::env::ENV;
use crate::utils::now_nanos;
use crate::{client, TestEnv};
use constants::MINUTE_IN_MS;
use ledger_utils::create_pending_transaction;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::random_from_u128;
use types::{CryptoContent, CryptoTransaction, Cryptocurrency, MessageContentInitial};
use user_canister::set_pin_number::PinNumberVerification;

#[test]
fn can_set_pin_number_by_providing_current() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);

    client::user::happy_path::set_pin_number(env, &user, None, Some("1000".to_string()));

    let initial_state1 = client::user::happy_path::initial_state(env, &user);

    assert!(initial_state1.pin_number_settings.is_some());
    assert!(initial_state1.pin_number_settings.unwrap().attempts_blocked_until.is_none());

    client::user::happy_path::set_pin_number(env, &user, Some("1000".to_string()), Some("1001".to_string()));
    client::user::happy_path::set_pin_number(env, &user, Some("1001".to_string()), None);

    let initial_state2 = client::user::happy_path::initial_state(env, &user);

    assert!(initial_state2.pin_number_settings.is_none());
}

#[test_case(true)]
#[test_case(false)]
fn can_set_pin_number_by_providing_recent_delegation(within_5_minutes: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let (user, delegation) = client::register_user_and_include_delegation(env, canister_ids);

    client::user::happy_path::set_pin_number(env, &user, None, Some("1000".to_string()));

    let initial_state1 = client::user::happy_path::initial_state(env, &user);

    assert!(initial_state1.pin_number_settings.is_some());
    assert!(initial_state1.pin_number_settings.unwrap().attempts_blocked_until.is_none());

    let advance_by = if within_5_minutes { Duration::from_secs(299) } else { Duration::from_secs(301) };
    env.advance_time(advance_by);

    let set_pin_number_response = client::user::set_pin_number(
        env,
        user.principal,
        user.canister(),
        &user_canister::set_pin_number::Args {
            new: None,
            verification: PinNumberVerification::Delegation(delegation),
        },
    );

    let initial_state2 = client::user::happy_path::initial_state(env, &user);

    if within_5_minutes {
        assert!(matches!(
            set_pin_number_response,
            user_canister::set_pin_number::Response::Success
        ));
        assert!(initial_state2.pin_number_settings.is_none());
    } else {
        assert!(matches!(
            set_pin_number_response,
            user_canister::set_pin_number::Response::DelegationTooOld
        ));
        assert!(initial_state2.pin_number_settings.is_some());
    }
}

#[test]
fn attempts_blocked_after_incorrect_attempts() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);

    client::user::happy_path::set_pin_number(env, &user, None, Some("1000".to_string()));

    for i in 1..5 {
        let response = client::user::set_pin_number(
            env,
            user.principal,
            user.canister(),
            &user_canister::set_pin_number::Args {
                verification: PinNumberVerification::PIN(format!("100{i}").into()),
                new: Some("2000".to_string().into()),
            },
        );

        match i {
            1 | 2 => {
                assert!(matches!(response, user_canister::set_pin_number::Response::PinIncorrect(0)))
            }
            3 => {
                assert!(matches!(
                    response,
                    user_canister::set_pin_number::Response::PinIncorrect(delay) if delay > 0
                ));
            }
            _ => {
                assert!(matches!(
                    response,
                    user_canister::set_pin_number::Response::TooManyFailedPinAttempts(delay) if delay > 0
                ));
            }
        }
    }

    let initial_state = client::user::happy_path::initial_state(env, &user);

    assert!(initial_state.pin_number_settings.unwrap().attempts_blocked_until.is_some());

    env.advance_time(Duration::from_millis(5 * MINUTE_IN_MS + 1));

    client::user::happy_path::set_pin_number(env, &user, Some("1000".to_string()), Some("1001".to_string()));

    let initial_state = client::user::happy_path::initial_state(env, &user);

    assert!(initial_state.pin_number_settings.unwrap().attempts_blocked_until.is_none());
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

    let user1 = client::register_user(env, canister_ids);
    let user2 = client::register_user(env, canister_ids);

    client::user::happy_path::set_pin_number(env, &user1, None, Some("1000".to_string()));

    // Send user1 some ICP
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user1.user_id, 1_000_000_000);

    let response = client::user::send_message_v2(
        env,
        user1.principal,
        user1.user_id.into(),
        &user_canister::send_message_v2::Args {
            recipient: user2.user_id,
            thread_root_message_index: None,
            message_id: random_from_u128(),
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
            block_level_markdown: false,
            message_filter_failed: None,
            pin: match test_case {
                1 => Some("1000".to_string().into()),
                2 => Some("2000".to_string().into()),
                3 => None,
                _ => unreachable!(),
            },
            correlation_id: 0,
        },
    );

    match test_case {
        1 => assert!(matches!(
            response,
            user_canister::send_message_v2::Response::TransferSuccessV2(_)
        )),
        2 => assert!(matches!(response, user_canister::send_message_v2::Response::PinIncorrect(_))),
        3 => assert!(matches!(response, user_canister::send_message_v2::Response::PinRequired)),
        _ => unreachable!(),
    }
}
