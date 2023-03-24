use crate::env::ENV;
use crate::utils::tick_many;
use crate::{client, TestEnv, T};
use ic_ledger_types::Tokens;
use std::ops::Deref;
use std::time::Duration;

#[test]
fn icp_is_burned_into_cycles() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    client::icrc1::happy_path::transfer(
        env,
        *controller,
        canister_ids.icp_ledger,
        canister_ids.cycles_dispenser,
        1_000_000_000_000u64,
    );

    let icp_balance_e8s = client::icrc1::happy_path::balance_of(&env, canister_ids.icp_ledger, canister_ids.cycles_dispenser);
    let cycles_balance = env.cycle_balance(canister_ids.cycles_dispenser.as_slice().try_into().unwrap());

    client::cycles_dispenser::update_config(
        env,
        *controller,
        canister_ids.cycles_dispenser,
        &cycles_dispenser_canister::update_config::Args {
            min_cycles_balance: Some(cycles_balance + (10 * T)),
            min_interval: None,
            max_top_up_amount: None,
            icp_burn_amount: Some(Tokens::from_e8s(10_000_000_000)),
        },
    );

    env.advance_time(Duration::from_secs(500));

    tick_many(env, 20);

    let new_icp_balance_e8s =
        client::icrc1::happy_path::balance_of(&env, canister_ids.icp_ledger, canister_ids.cycles_dispenser);
    let new_cycles_balance = env.cycle_balance(canister_ids.cycles_dispenser.as_slice().try_into().unwrap());

    assert!(new_icp_balance_e8s < icp_balance_e8s);
    assert!(
        new_cycles_balance > cycles_balance,
        "{cycles_balance} {new_cycles_balance} {}",
        canister_ids.cycles_dispenser
    );
}
