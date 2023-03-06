use crate::client;
use crate::setup::{setup_env, TestEnv};
use crate::utils::{now_millis, tick_many};
use std::time::Duration;
use types::{Cryptocurrency, DiamondMembershipPlanDuration};

#[test]
fn can_upgrade_to_diamond() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let user = client::user_index::happy_path::register_user(&mut env, canister_ids.user_index);

    client::icrc1::happy_path::transfer(
        &mut env,
        controller,
        canister_ids.icp_ledger,
        user.user_id.into(),
        1_000_000_000u64,
    );

    let now = now_millis(&env);

    let diamond_response = client::user_index::pay_for_diamond_membership(
        &mut env,
        user.principal,
        canister_ids.user_index,
        &user_index_canister::pay_for_diamond_membership::Args {
            duration: DiamondMembershipPlanDuration::OneMonth,
            token: Cryptocurrency::InternetComputer,
            expected_price_e8s: 20_000_000,
            recurring: false,
        },
    );

    let expected_expiry = now + DiamondMembershipPlanDuration::OneMonth.as_millis();

    if let user_index_canister::pay_for_diamond_membership::Response::Success(d) = diamond_response {
        assert_eq!(d.expires_at, expected_expiry);
        assert!(d.recurring.is_none());
    } else {
        panic!();
    }

    let user_response = client::user_index::happy_path::current_user(&env, user.principal, canister_ids.user_index);
    assert_eq!(
        user_response.diamond_membership_details.as_ref().unwrap().expires_at,
        expected_expiry
    );
    assert!(user_response.diamond_membership_details.as_ref().unwrap().recurring.is_none());

    let new_balance = client::icrc1::happy_path::balance_of(&env, canister_ids.icp_ledger, user.user_id.into());
    assert_eq!(new_balance, 1_000_000_000 - 20_000_000);
}

#[test]
fn membership_renews_automatically_if_set_to_recurring() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let user = client::user_index::happy_path::register_user(&mut env, canister_ids.user_index);

    client::icrc1::happy_path::transfer(
        &mut env,
        controller,
        canister_ids.icp_ledger,
        user.user_id.into(),
        1_000_000_000u64,
    );

    client::user_index::pay_for_diamond_membership(
        &mut env,
        user.principal,
        canister_ids.user_index,
        &user_index_canister::pay_for_diamond_membership::Args {
            duration: DiamondMembershipPlanDuration::OneMonth,
            token: Cryptocurrency::InternetComputer,
            expected_price_e8s: 20_000_000,
            recurring: true,
        },
    );

    let start_time = now_millis(&env);
    let one_month_millis = DiamondMembershipPlanDuration::OneMonth.as_millis();
    env.advance_time(Duration::from_millis(one_month_millis));

    tick_many(&mut env, 5);

    let user_response = client::user_index::happy_path::current_user(&env, user.principal, canister_ids.user_index);
    assert_eq!(
        user_response.diamond_membership_details.as_ref().unwrap().expires_at,
        start_time + (2 * one_month_millis)
    );
    assert!(user_response.diamond_membership_details.as_ref().unwrap().recurring.is_some());

    let new_balance = client::icrc1::happy_path::balance_of(&env, canister_ids.icp_ledger, user.user_id.into());
    assert_eq!(new_balance, 1_000_000_000 - 40_000_000);
}
