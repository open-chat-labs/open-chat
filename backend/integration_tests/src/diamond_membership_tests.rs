use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{client, TestEnv};
use constants::{DAY_IN_MS, MINUTE_IN_MS, SNS_GOVERNANCE_CANISTER_ID};
use jwt::{verify_jwt, Claims};
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use types::{
    Achievement, ChitEarnedReason, Cryptocurrency, DiamondMembershipDetails, DiamondMembershipFees,
    DiamondMembershipPlanDuration, DiamondMembershipSubscription, ReferralStatus,
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
    let claims: Claims<DiamondMembershipDetails> = verify_jwt(&diamond_response.proof_jwt, &public_key).unwrap();

    let claims_expiry = claims.exp() * 1000;
    assert!(now < claims_expiry && claims_expiry < now + DAY_IN_MS);
    assert_eq!(claims.claim_type(), "diamond_membership");
    assert_eq!(claims.custom().expires_at, diamond_response.expires_at);

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

    let fees = DiamondMembershipFees::default();

    let (expected_price, transfer_fee) = if pay_in_chat {
        (fees.chat_price_e8s(duration) as u128, Cryptocurrency::CHAT.fee().unwrap())
    } else {
        (
            fees.icp_price_e8s(duration) as u128,
            Cryptocurrency::InternetComputer.fee().unwrap(),
        )
    };

    let new_balance = client::ledger::happy_path::balance_of(env, ledger, user.user_id);
    assert_eq!(new_balance, 10_000_000_000 - expected_price);

    let treasury_balance = client::ledger::happy_path::balance_of(env, ledger, SNS_GOVERNANCE_CANISTER_ID);

    assert_eq!(treasury_balance - init_treasury_balance, expected_price - (2 * transfer_fee));
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
    assert!(user_response
        .diamond_membership_details
        .as_ref()
        .unwrap()
        .subscription
        .is_active());

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

    assert!(user_state
        .achievements
        .iter()
        .any(|ev| if let ChitEarnedReason::Achievement(a) = &ev.reason {
            matches!(a, Achievement::Referred1stUser)
        } else {
            false
        }));

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
