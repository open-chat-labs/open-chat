use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::utils::{now_millis, tick_many, try_metrics};
use crate::{TestEnv, client};
use constants::ICP_LEDGER_CANISTER_ID;
use constants::{CHAT_TRANSFER_FEE, DAY_IN_MS, ICP_TRANSFER_FEE, MINUTE_IN_MS, SNS_GOVERNANCE_CANISTER_ID};
use jwt::{Claims, verify_and_decode};
use pocket_ic::PocketIc;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::random_principal;
use types::{
    Achievement, CLAIM_TYPE_DIAMOND_MEMBERSHIP, ChitEventType, DiamondMembershipDetails, DiamondMembershipFees,
    DiamondMembershipPlanDuration, DiamondMembershipSubscription, ReferralStatus, icrc1,
};

#[test_case(true, false)]
#[test_case(true, true)]
#[test_case(false, false)]
#[test_case(false, true)]
fn can_upgrade_to_diamond(pay_in_chat: bool, lifetime: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let ledger = if pay_in_chat { canister_ids.chat_ledger } else { canister_ids.icp_ledger };

    let init_treasury_balance = client::ledger::happy_path::balance_of(env, ledger, SNS_GOVERNANCE_CANISTER_ID);

    let user = client::register_user(env, canister_ids);

    client::ledger::happy_path::transfer(env, *controller, ledger, user.user_id, 10_000_000_000);

    let now = now_millis(env);

    let duration = if lifetime {
        DiamondMembershipPlanDuration::Lifetime
    } else {
        DiamondMembershipPlanDuration::OneMonth
    };

    let expected_expiry = now + duration.as_millis();

    let diamond_response = client::user_index::happy_path::pay_for_diamond_membership(
        env,
        user.principal,
        canister_ids.user_index,
        duration,
        pay_in_chat,
        false,
    );

    tick_many(env, 10);

    assert_eq!(diamond_response.expires_at, expected_expiry);
    assert!(!diamond_response.subscription.is_active());

    let public_key = client::user_index::happy_path::public_key(env, canister_ids.user_index);
    let claims: Claims<DiamondMembershipDetails> =
        verify_and_decode(&diamond_response.proof_jwt, &public_key, CLAIM_TYPE_DIAMOND_MEMBERSHIP).unwrap();

    let claims_expiry = claims.exp_ms();
    assert!(now < claims_expiry && claims_expiry < now + DAY_IN_MS);
    assert_eq!(claims.claim_type(), "diamond_membership");
    assert_eq!(claims.custom().expires_at, diamond_response.expires_at);

    let user_response = client::user_index::happy_path::current_user(env, user.principal, canister_ids.user_index);
    assert_eq!(
        user_response.diamond_membership_details.as_ref().unwrap().expires_at,
        expected_expiry
    );
    assert!(
        !user_response
            .diamond_membership_details
            .as_ref()
            .unwrap()
            .subscription
            .is_active()
    );

    let fees = DiamondMembershipFees::default();

    let (expected_price, transfer_fee) = if pay_in_chat {
        (fees.chat_price_e8s(duration) as u128, CHAT_TRANSFER_FEE)
    } else {
        (fees.icp_price_e8s(duration) as u128, ICP_TRANSFER_FEE)
    };

    let new_balance = client::ledger::happy_path::balance_of(env, ledger, user.user_id);
    assert_eq!(new_balance, 10_000_000_000 - expected_price);

    let treasury_balance = client::ledger::happy_path::balance_of(env, ledger, SNS_GOVERNANCE_CANISTER_ID);

    assert_eq!(treasury_balance - init_treasury_balance, expected_price - (2 * transfer_fee));
}

// The UserIndex's payment of a diamond membership fee to the treasury, if its ledger can't be called
// (eg. because the ledger is being upgraded), is retried after a delay which doubles with each
// failure, rather than round after round. A stopped ledger is first retried after 10 seconds.
#[test]
fn treasury_payment_failing_to_call_into_ledger_is_retried_with_backoff() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let ledger = canister_ids.icp_ledger;
    let user = client::register_user(env, canister_ids);
    let user_balance = 10_000_000_000;
    client::ledger::happy_path::transfer(env, *controller, ledger, user.user_id, user_balance);

    let treasury_balance = |env: &PocketIc| client::ledger::happy_path::balance_of(env, ledger, SNS_GOVERNANCE_CANISTER_ID);
    let awaiting_retry = |env: &PocketIc| {
        try_metrics(env, canister_ids.user_index).unwrap()["payments_awaiting_retry"]
            .as_u64()
            .unwrap()
    };
    let treasury_balance_before = treasury_balance(env);
    let awaiting_retry_before = awaiting_retry(env);

    let duration = DiamondMembershipPlanDuration::OneMonth;
    let price = DiamondMembershipFees::default().icp_price_e8s(duration);
    let message_id = env
        .submit_call(
            canister_ids.user_index,
            user.principal,
            "pay_for_diamond_membership_msgpack",
            msgpack::serialize_then_unwrap(&user_index_canister::pay_for_diamond_membership::Args {
                duration,
                ledger,
                expected_price_e8s: price,
                recurring: false,
                from_account: None,
            }),
        )
        .unwrap();

    // The ledger is stopped as soon as the user has been charged, so that it is stopped by the time
    // the UserIndex pays the treasury, which it does in a later round
    let charged = (0..50).any(|_| {
        env.tick();
        client::ledger::happy_path::balance_of(env, ledger, user.user_id) < user_balance
    });
    assert!(charged);
    stop_canister(env, *controller, ledger);
    let response: user_index_canister::pay_for_diamond_membership::Response =
        msgpack::deserialize_then_unwrap(&env.await_call(message_id).unwrap());
    assert!(matches!(
        response,
        user_index_canister::pay_for_diamond_membership::Response::Success(_)
    ));

    tick_many(env, 20);
    assert_eq!(awaiting_retry(env), awaiting_retry_before + 1);

    // Retried 10 seconds after the 1st failure, by when the ledger is still stopped
    env.advance_time(Duration::from_secs(11));
    tick_many(env, 10);

    // Then 20 seconds after the 2nd, by when the ledger is back. Time doesn't pass as the rounds do,
    // so however many there are before then, the payment isn't retried.
    start_canister(env, *controller, ledger);
    tick_many(env, 20);
    env.advance_time(Duration::from_secs(15));
    tick_many(env, 10);
    assert_eq!(treasury_balance(env), treasury_balance_before);
    env.advance_time(Duration::from_secs(6));
    tick_many(env, 10);
    assert_eq!(
        treasury_balance(env) - treasury_balance_before,
        price as u128 - (2 * ICP_TRANSFER_FEE)
    );
    assert_eq!(awaiting_retry(env), awaiting_retry_before);
}

// Paying from a wallet OpenChat does not control. The user's own account is never touched - the
// payment is pulled from the wallet via ICRC-2 against an allowance it granted the user's canister.
#[test]
fn can_upgrade_to_diamond_from_approved_account() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let init_treasury_balance =
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, SNS_GOVERNANCE_CANISTER_ID);

    let user = client::register_user(env, canister_ids);
    let wallet = random_principal();

    let duration = DiamondMembershipPlanDuration::OneMonth;
    let fees = DiamondMembershipFees::default();
    let price = fees.icp_price_e8s(duration);

    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, wallet, 10_000_000_000);
    // The allowance has to cover the transfer fee on top of the amount pulled.
    client::ledger::happy_path::approve(
        env,
        wallet,
        canister_ids.icp_ledger,
        user.user_id,
        price as u128 + ICP_TRANSFER_FEE,
    );

    let wallet_balance_before = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, wallet);

    let now = now_millis(env);
    let response = client::user_index::pay_for_diamond_membership(
        env,
        user.principal,
        canister_ids.user_index,
        &user_index_canister::pay_for_diamond_membership::Args {
            duration,
            ledger: ICP_LEDGER_CANISTER_ID,
            expected_price_e8s: price,
            recurring: false,
            from_account: Some(wallet.into()),
        },
    );

    let success = match response {
        user_index_canister::pay_for_diamond_membership::Response::Success(result) => result,
        response => panic!("'pay_for_diamond_membership' error: {response:?}"),
    };

    tick_many(env, 10);

    assert_eq!(success.expires_at, now + duration.as_millis());

    // The wallet paid, and the user's own account was never touched.
    assert_eq!(
        wallet_balance_before - client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, wallet),
        price as u128
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user.user_id),
        0
    );

    let treasury_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, SNS_GOVERNANCE_CANISTER_ID);
    assert_eq!(
        treasury_balance - init_treasury_balance,
        price as u128 - (2 * ICP_TRANSFER_FEE)
    );
}

// Paying from our own account would need an approval we had granted ourselves, so it is rejected up
// front rather than left to fail at the ledger.
#[test]
fn paying_for_diamond_membership_from_own_account_is_rejected() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user.user_id, 10_000_000_000);

    let duration = DiamondMembershipPlanDuration::OneMonth;
    let fees = DiamondMembershipFees::default();

    let response = client::user_index::pay_for_diamond_membership(
        env,
        user.principal,
        canister_ids.user_index,
        &user_index_canister::pay_for_diamond_membership::Args {
            duration,
            ledger: ICP_LEDGER_CANISTER_ID,
            expected_price_e8s: fees.icp_price_e8s(duration),
            recurring: false,
            from_account: Some(icrc1::Account::legacy_for_user(user.user_id)),
        },
    );

    assert!(matches!(
        response,
        user_index_canister::pay_for_diamond_membership::Response::Error(_)
    ));

    // The rejection has to roll back the in-progress flag, else the user could never retry.
    let success = client::user_index::happy_path::pay_for_diamond_membership(
        env,
        user.principal,
        canister_ids.user_index,
        duration,
        false,
        false,
    );
    assert!(success.expires_at > now_millis(env));
}

// A one off approval must not silently fund renewals, so recurring payments always come from the
// user's own account even when the first payment came from a wallet.
#[test]
fn recurring_diamond_payment_comes_from_own_account() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_user(env, canister_ids);
    let wallet = random_principal();

    let duration = DiamondMembershipPlanDuration::OneMonth;
    let fees = DiamondMembershipFees::default();
    let price = fees.icp_price_e8s(duration) as u128;

    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, wallet, 10_000_000_000);
    // Deliberately approve enough for several payments - only the first should ever spend it.
    client::ledger::happy_path::approve(env, wallet, canister_ids.icp_ledger, user.user_id, 10 * price);
    // Enough in the user's own account to cover the renewal.
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user.user_id, 10_000_000_000);

    let wallet_balance_before = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, wallet);
    let start_time = now_millis(env);

    client::user_index::pay_for_diamond_membership(
        env,
        user.principal,
        canister_ids.user_index,
        &user_index_canister::pay_for_diamond_membership::Args {
            duration,
            ledger: ICP_LEDGER_CANISTER_ID,
            expected_price_e8s: fees.icp_price_e8s(duration),
            recurring: true,
            from_account: Some(wallet.into()),
        },
    );

    tick_many(env, 10);

    // The first payment came from the wallet, leaving the user's own account untouched.
    assert_eq!(
        wallet_balance_before - client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, wallet),
        price
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user.user_id),
        10_000_000_000
    );

    let one_month_millis = duration.as_millis();
    env.advance_time(Duration::from_millis(one_month_millis - (30 * MINUTE_IN_MS)));
    tick_many(env, 5);

    let user_response = client::user_index::happy_path::current_user(env, user.principal, canister_ids.user_index);
    assert_eq!(
        user_response.diamond_membership_details.as_ref().unwrap().expires_at,
        start_time + (2 * one_month_millis)
    );

    // The renewal came out of the user's own account, leaving the remaining allowance untouched.
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user.user_id),
        10_000_000_000 - price
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, wallet),
        wallet_balance_before - price
    );
}

#[test_case(false; "without_ledger_error")]
#[test_case(true; "with_ledger_error")]
fn membership_renews_automatically_if_set_to_recurring(ledger_error: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let start_time = now_millis(env);

    let user = client::register_user(env, canister_ids);

    client::upgrade_user(
        &user,
        env,
        canister_ids,
        *controller,
        DiamondMembershipPlanDuration::OneMonth,
        true,
    );

    let one_month_millis = DiamondMembershipPlanDuration::OneMonth.as_millis();
    env.advance_time(Duration::from_millis(one_month_millis - (30 * MINUTE_IN_MS)));

    if ledger_error {
        stop_canister(env, *controller, canister_ids.icp_ledger);
        tick_many(env, 5);
        start_canister(env, *controller, canister_ids.icp_ledger);
        env.advance_time(Duration::from_millis(15 * MINUTE_IN_MS));
        tick_many(env, 5);
    }

    tick_many(env, 5);

    let user_response = client::user_index::happy_path::current_user(env, user.principal, canister_ids.user_index);
    assert_eq!(
        user_response.diamond_membership_details.as_ref().unwrap().expires_at,
        start_time + (2 * one_month_millis)
    );
    assert!(
        user_response
            .diamond_membership_details
            .as_ref()
            .unwrap()
            .subscription
            .is_active()
    );

    let new_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user.user_id);
    let fees = DiamondMembershipFees::default();

    assert_eq!(
        new_balance,
        1_000_000_000 - (2 * fees.icp_price_e8s(DiamondMembershipPlanDuration::OneMonth) as u128)
    );
}

#[test]
fn referrer_awarded_chit_when_referred_gets_diamond() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    // Register referrer and upgrade to Diamond
    let user_a = client::register_user(env, canister_ids);
    client::upgrade_user(
        &user_a,
        env,
        canister_ids,
        *controller,
        DiamondMembershipPlanDuration::OneMonth,
        true,
    );

    // Register user_b with referral from user_a
    let user_b = client::register_user_with_referrer(env, canister_ids, Some(user_a.user_id.to_string()));

    // Upgrade user_b to Diamond
    client::upgrade_user(
        &user_b,
        env,
        canister_ids,
        *controller,
        DiamondMembershipPlanDuration::OneMonth,
        true,
    );

    tick_many(env, 3);

    // Check user_a has received expected CHIT reward, achievement and referral
    //
    let user_state = client::user::happy_path::initial_state(env, &user_a);

    assert!(
        user_state
            .achievements
            .iter()
            .any(|ev| if let ChitEventType::Achievement(a) = &ev.reason {
                matches!(a, Achievement::Referred1stUser)
            } else {
                false
            })
    );

    assert_eq!(user_state.referrals.len(), 1);
    assert_eq!(user_state.referrals[0].user_id, user_b.user_id);
    assert!(matches!(user_state.referrals[0].status, ReferralStatus::Diamond));

    assert_eq!(
        user_state.chit_balance as u32,
        Achievement::UpgradedToDiamond.chit_reward()
            + Achievement::Referred1stUser.chit_reward()
            + ReferralStatus::Diamond.chit_reward()
    );

    // Upgrade user_b to Lifetime Diamond
    client::upgrade_user(
        &user_b,
        env,
        canister_ids,
        *controller,
        DiamondMembershipPlanDuration::Lifetime,
        true,
    );

    tick_many(env, 3);

    // Check user_a has received expected CHIT reward and referral status has been updated
    //
    let user_state = client::user::happy_path::initial_state(env, &user_a);

    assert_eq!(user_state.referrals.len(), 1);
    assert_eq!(user_state.referrals[0].user_id, user_b.user_id);
    assert!(matches!(user_state.referrals[0].status, ReferralStatus::LifetimeDiamond));

    assert_eq!(
        user_state.chit_balance as u32,
        Achievement::UpgradedToDiamond.chit_reward()
            + Achievement::Referred1stUser.chit_reward()
            + ReferralStatus::LifetimeDiamond.chit_reward()
    );
}

#[test_case(false)]
#[test_case(true)]
fn update_subscription_succeeds(disable: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let start_time = now_millis(env);

    let user = client::register_user(env, canister_ids);

    client::upgrade_user(
        &user,
        env,
        canister_ids,
        *controller,
        DiamondMembershipPlanDuration::OneMonth,
        true,
    );

    client::user_index::update_diamond_membership_subscription(
        env,
        user.principal,
        canister_ids.user_index,
        &user_index_canister::update_diamond_membership_subscription::Args {
            pay_in_chat: None,
            subscription: Some(if disable {
                DiamondMembershipSubscription::Disabled
            } else {
                DiamondMembershipSubscription::OneYear
            }),
        },
    );

    let one_month_millis = DiamondMembershipPlanDuration::OneMonth.as_millis();
    env.advance_time(Duration::from_millis(one_month_millis - (30 * MINUTE_IN_MS)));

    tick_many(env, 5);

    let user_response = client::user_index::happy_path::current_user(env, user.principal, canister_ids.user_index);
    let fees = DiamondMembershipFees::default();

    if disable {
        assert_eq!(
            user_response.diamond_membership_details.as_ref().unwrap().expires_at,
            start_time + one_month_millis
        );
        assert!(matches!(
            user_response.diamond_membership_details.as_ref().unwrap().subscription,
            DiamondMembershipSubscription::Disabled
        ));

        let new_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user.user_id);
        assert_eq!(
            new_balance,
            1_000_000_000 - fees.icp_price_e8s(DiamondMembershipPlanDuration::OneMonth) as u128
        );
    } else {
        let one_year_millis = DiamondMembershipPlanDuration::OneYear.as_millis();
        assert_eq!(
            user_response.diamond_membership_details.as_ref().unwrap().expires_at,
            start_time + one_month_millis + one_year_millis
        );
        assert!(matches!(
            user_response.diamond_membership_details.as_ref().unwrap().subscription,
            DiamondMembershipSubscription::OneYear
        ));

        let new_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user.user_id);
        assert_eq!(
            new_balance,
            1_000_000_000
                - (fees.icp_price_e8s(DiamondMembershipPlanDuration::OneMonth)
                    + fees.icp_price_e8s(DiamondMembershipPlanDuration::OneYear)) as u128
        );
    }
}
