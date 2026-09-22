use crate::client::{create_canister, create_canister_with_id};
use crate::env::ENV;
use crate::{T, TestEnv};
use candid::Principal;
use pocket_ic::{PocketIc, RejectResponse};
use std::ops::Deref;
use types::CanisterId;

const CYCLES_REFUNDER_WAT: &str = include_str!("../../canisters/cycles_refunder/cycles_refunder.wat");

// The canister ID baked into the wat
const PROD_CYCLES_DISPENSER_CANISTER_ID: &str = "gonut-hqaaa-aaaaf-aby7a-cai";

// Roughly 80B cycles necessarily remain in the canister: the IC withholds the execution
// prepayment for the update (~40B) and the reservation for the call's response and callback
// (~42B) until after they complete, so neither can be attached to the call.
const MAX_RESIDUAL_BALANCE: u128 = 100_000_000_000;

#[test]
fn cycles_refunder_sends_all_spare_cycles_to_the_prod_cycles_dispenser_by_default() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, controller, .. } = wrapper.env();

    let cycles_dispenser = create_canister_with_id(env, *controller, PROD_CYCLES_DISPENSER_CANISTER_ID);

    // An uninstalled user canister which still holds cycles
    let canister_id = create_canister(env, *controller);

    let dispenser_balance_before = env.cycle_balance(cycles_dispenser);
    let canister_balance_before = env.cycle_balance(canister_id);
    assert!(canister_balance_before >= 1000 * T);

    env.install_canister(canister_id, wasm(), vec![], Some(*controller));

    let refunded = refund(env, canister_id).unwrap();

    assert!(canister_balance_before - refunded < MAX_RESIDUAL_BALANCE);
    assert!(env.cycle_balance(canister_id) < MAX_RESIDUAL_BALANCE);
    assert_eq!(env.cycle_balance(cycles_dispenser), dispenser_balance_before + refunded);

    // Calling it again is harmless, there is nothing left to send
    assert_eq!(refund(env, canister_id).unwrap(), 0);
    assert_eq!(env.cycle_balance(cycles_dispenser), dispenser_balance_before + refunded);

    // The canister can be uninstalled again afterwards
    env.uninstall_canister(canister_id, Some(*controller)).unwrap();

    // Don't return the env to the pool with the prod canister ID taken
    wrapper.discard();
}

#[test]
fn cycles_refunder_target_can_be_overridden_by_init_arg() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let canister_id = create_canister(env, *controller);

    let dispenser_balance_before = env.cycle_balance(canister_ids.cycles_dispenser);

    env.install_canister(
        canister_id,
        wasm(),
        candid::encode_one(canister_ids.cycles_dispenser).unwrap(),
        Some(*controller),
    );

    let refunded = refund(env, canister_id).unwrap();

    assert!(refunded > 999 * T);
    assert!(env.cycle_balance(canister_id) < MAX_RESIDUAL_BALANCE);
    assert_eq!(
        env.cycle_balance(canister_ids.cycles_dispenser),
        dispenser_balance_before + refunded
    );
}

#[test]
fn cycles_refunder_forwards_reject_and_keeps_cycles_if_deposit_fails() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, controller, .. } = wrapper.env();

    let canister_id = create_canister(env, *controller);
    let canister_balance_before = env.cycle_balance(canister_id);

    // A canister which doesn't exist in the test env (the prod UserIndex)
    let target = Principal::from_text("4bkt6-4aaaa-aaaaf-aaaiq-cai").unwrap();
    env.install_canister(canister_id, wasm(), candid::encode_one(target).unwrap(), Some(*controller));

    let reject = refund(env, canister_id).unwrap_err();
    assert!(reject.reject_message.contains(&target.to_string()), "{reject:?}");

    // The cycles were returned, only the fees for the messages themselves were spent
    assert!(canister_balance_before - env.cycle_balance(canister_id) < 1_000_000_000);

    // A further attempt is rejected the same way, rather than complaining a refund is in progress
    let reject = refund(env, canister_id).unwrap_err();
    assert!(reject.reject_message.contains(&target.to_string()), "{reject:?}");
}

#[test]
fn cycles_refunder_rejects_invalid_init_arg() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, controller, .. } = wrapper.env();

    let canister_id = create_canister(env, *controller);

    let error = env
        .reinstall_canister(canister_id, wasm(), candid::encode_one(123u32).unwrap(), Some(*controller))
        .unwrap_err();
    assert!(error.reject_message.contains("init arg must be (principal)"), "{error:?}");
}

fn wasm() -> Vec<u8> {
    wat::parse_str(CYCLES_REFUNDER_WAT).unwrap()
}

fn refund(env: &PocketIc, canister_id: CanisterId) -> Result<u128, RejectResponse> {
    env.update_call(
        canister_id,
        Principal::anonymous(),
        "refund",
        candid::encode_args(()).unwrap(),
    )
    .map(|bytes| {
        let refunded: u64 = candid::decode_one(&bytes).unwrap();
        refunded.into()
    })
}
