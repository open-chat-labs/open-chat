use crate::client::icrc1;
use crate::setup::{setup_env, TestEnv};
use crate::utils::tick_many;
use crate::{client, T};
use ic_icrc1::endpoints::NumTokens;
use ic_icrc1::Account;
use ic_ledger_types::Tokens;
use ic_state_machine_tests::PrincipalId;
use std::time::Duration;

#[test]
fn icp_is_burned_into_cycles() {
    let TestEnv {
        mut env,
        canister_ids,
        controller,
    } = setup_env();

    let account = Account::from(PrincipalId(canister_ids.cycles_dispenser));

    client::icrc1::icrc1_transfer(
        &mut env,
        controller,
        canister_ids.icp_ledger,
        &icrc1::icrc1_transfer::Args {
            from_subaccount: None,
            to: account.clone(),
            fee: None,
            created_at_time: None,
            memo: None,
            amount: NumTokens::from(1_000_000_000_000u64),
        },
    )
    .unwrap();

    let icp_balance_e8s = client::icrc1::icrc1_balance_of(&env, controller, canister_ids.icp_ledger, &account);
    let cycles_balance = env.cycle_balance(canister_ids.cycles_dispenser.as_slice().try_into().unwrap());

    client::cycles_dispenser::update_config(
        &mut env,
        controller,
        canister_ids.cycles_dispenser,
        &cycles_dispenser_canister::update_config::Args {
            min_cycles_balance: Some(cycles_balance + (10 * T)),
            min_interval: None,
            max_top_up_amount: None,
            icp_burn_amount: Some(Tokens::from_e8s(10_000_000_000)),
        },
    );

    env.advance_time(Duration::from_secs(500));

    tick_many(&mut env, 20);

    let new_icp_balance_e8s = client::icrc1::icrc1_balance_of(&env, controller, canister_ids.icp_ledger, &account);
    let new_cycles_balance = env.cycle_balance(canister_ids.cycles_dispenser.as_slice().try_into().unwrap());

    assert!(new_icp_balance_e8s < icp_balance_e8s);
    assert!(
        new_cycles_balance > cycles_balance,
        "{cycles_balance} {new_cycles_balance} {}",
        canister_ids.cycles_dispenser
    );
}
