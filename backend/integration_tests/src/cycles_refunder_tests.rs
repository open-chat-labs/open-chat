use crate::client::{create_canister, create_canister_with_id};
use crate::env::ENV;
use crate::{T, TestEnv};
use std::ops::Deref;

const CYCLES_REFUNDER_WAT: &str = include_str!("../../canisters/cycles_refunder/cycles_refunder.wat");

// The canister ID baked into the wat
const CYCLES_DISPENSER_CANISTER_ID: &str = "gonut-hqaaa-aaaaf-aby7a-cai";

#[test]
fn cycles_refunder_sends_all_spare_cycles_to_the_cycles_dispenser() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, controller, .. } = wrapper.env();

    let cycles_dispenser = create_canister_with_id(env, *controller, CYCLES_DISPENSER_CANISTER_ID);

    // An uninstalled user canister which still holds cycles
    let canister_id = create_canister(env, *controller);
    let wasm = wat::parse_str(CYCLES_REFUNDER_WAT).unwrap();

    let dispenser_balance_before = env.cycle_balance(cycles_dispenser);
    let canister_balance_before = env.cycle_balance(canister_id);
    assert!(canister_balance_before >= 1000 * T);

    env.install_canister(canister_id, wasm, vec![], Some(*controller));

    let refunded = refund(env, canister_id);

    // Everything is sent apart from what the IC withholds until the update and the call have
    // both completed: the execution prepayment for the update (~40B), the reservation for the
    // call's response and callback (~42B), and ~1B of slack.
    let leftover = canister_balance_before - refunded;
    assert!(leftover < 100_000_000_000, "{leftover}");
    assert_eq!(env.cycle_balance(cycles_dispenser), dispenser_balance_before + refunded);
    assert!(
        env.cycle_balance(canister_id) <= leftover,
        "{}",
        env.cycle_balance(canister_id)
    );

    // Calling it again is harmless, there is nothing left to send
    assert_eq!(refund(env, canister_id), 0);
    assert_eq!(env.cycle_balance(cycles_dispenser), dispenser_balance_before + refunded);

    // The canister can be uninstalled again afterwards
    env.uninstall_canister(canister_id, Some(*controller)).unwrap();
}

fn refund(env: &pocket_ic::PocketIc, canister_id: types::CanisterId) -> u128 {
    let response = env
        .update_call(
            canister_id,
            candid::Principal::anonymous(),
            "refund",
            candid::encode_args(()).unwrap(),
        )
        .unwrap();
    let refunded: u64 = candid::decode_one(&response).unwrap();
    refunded.into()
}
