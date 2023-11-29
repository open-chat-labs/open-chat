use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{client, TestEnv};
use serial_test::serial;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use types::{Cryptocurrency, DiamondMembershipPlanDuration, DiamondMembershipSubscription};
use utils::consts::SNS_GOVERNANCE_CANISTER_ID;
use utils::time::MINUTE_IN_MS;

#[test]
#[serial]
fn can_upgrade_to_diamond() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let init_treasury_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, SNS_GOVERNANCE_CANISTER_ID);

    let user = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    client::icrc1::happy_path::transfer(
        env,
        *controller,
        canister_ids.icp_ledger,
        user.user_id.into(),
        1_000_000_000u64,
    );

    let now = now_millis(env);

    let expected_expiry = now + DiamondMembershipPlanDuration::OneMonth.as_millis();

    let diamond_response = client::user_index::happy_path::pay_for_diamond_membership(
        env,
        user.principal,
        canister_ids.user_index,
        DiamondMembershipPlanDuration::OneMonth,
        false,
    );

    tick_many(env, 10);

    assert_eq!(diamond_response.expires_at, expected_expiry);
    assert!(!diamond_response.subscription.is_active());

    let user_response = client::user_index::happy_path::current_user(env, user.principal, canister_ids.user_index);
    assert_eq!(
        user_response.diamond_membership_details.as_ref().unwrap().expires_at,
        expected_expiry
    );
    assert!(!user_response
        .diamond_membership_details
        .as_ref()
        .unwrap()
        .subscription
        .is_active());

    let new_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, user.user_id.into());
    assert_eq!(new_balance, 1_000_000_000 - 20_000_000);

    let treasury_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, SNS_GOVERNANCE_CANISTER_ID);

    assert_eq!(
        treasury_balance - init_treasury_balance,
        20_000_000 - (2 * Cryptocurrency::InternetComputer.fee().unwrap()) as u64
    );
}

#[test_case(false; "without_ledger_error")]
#[test_case(true; "with_ledger_error")]
#[serial]
fn membership_renews_automatically_if_set_to_recurring(ledger_error: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let start_time = now_millis(env);

    let user = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    client::upgrade_user(&user, env, canister_ids, *controller);

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
    assert!(user_response
        .diamond_membership_details
        .as_ref()
        .unwrap()
        .subscription
        .is_active());

    let new_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, user.user_id.into());
    assert_eq!(new_balance, 1_000_000_000 - 40_000_000);
}

#[test]
#[serial]
fn membership_payment_shared_with_referrer() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    // Register referrer and upgrade to Diamond
    let user_a = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);
    client::upgrade_user(&user_a, env, canister_ids, *controller);

    // Register user_b with referral from user_a
    let user_b = client::local_user_index::happy_path::register_user_with_referrer(
        env,
        canister_ids.local_user_index,
        Some(user_a.user_id.to_string()),
    );

    // Take a snapshot of the ledger and referrer ICP balances
    let init_treasury_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, SNS_GOVERNANCE_CANISTER_ID);
    let init_referrer_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, user_a.user_id.into());

    // Upgrade user_b to Diamond
    client::upgrade_user(&user_b, env, canister_ids, *controller);

    // Check the referrer has been credited with half the Diamond payment
    let balance_referrer = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, user_a.user_id.into());
    assert_eq!(balance_referrer - init_referrer_balance, 10_000_000);

    // Check the treasury has received the remainder less the fees
    let treasury_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, SNS_GOVERNANCE_CANISTER_ID);
    assert_eq!(
        treasury_balance - init_treasury_balance,
        10_000_000 - (3 * Cryptocurrency::InternetComputer.fee().unwrap()) as u64
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

    let user = client::local_user_index::happy_path::register_user(env, canister_ids.local_user_index);

    client::upgrade_user(&user, env, canister_ids, *controller);

    client::user_index::update_diamond_membership_subscription(
        env,
        user.principal,
        canister_ids.user_index,
        &user_index_canister::update_diamond_membership_subscription::Args {
            pay_in_chat: None,
            subscription: if disable {
                DiamondMembershipSubscription::Disabled
            } else {
                DiamondMembershipSubscription::OneYear
            },
        },
    );

    let one_month_millis = DiamondMembershipPlanDuration::OneMonth.as_millis();
    env.advance_time(Duration::from_millis(one_month_millis - (30 * MINUTE_IN_MS)));

    tick_many(env, 5);

    let user_response = client::user_index::happy_path::current_user(env, user.principal, canister_ids.user_index);

    if disable {
        assert_eq!(
            user_response.diamond_membership_details.as_ref().unwrap().expires_at,
            start_time + one_month_millis
        );
        assert!(matches!(
            user_response.diamond_membership_details.as_ref().unwrap().subscription,
            DiamondMembershipSubscription::Disabled
        ));

        let new_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, user.user_id.into());
        assert_eq!(new_balance, 1_000_000_000 - 20_000_000);
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

        let new_balance = client::icrc1::happy_path::balance_of(env, canister_ids.icp_ledger, user.user_id.into());
        assert_eq!(new_balance, 1_000_000_000 - 170_000_000);
    }
}
