use crate::client::{start_canister, stop_canister};
use crate::env::ENV;
use crate::utils::{now_millis, tick_many};
use crate::{T, TestEnv, client, wasms};
use candid::Principal;
use constants::DAY_IN_MS;
use ic_ledger_types::Tokens;
use pocket_ic::PocketIc;
use serde::Deserialize;
use std::ops::Deref;
use std::time::Duration;
use types::{CanisterId, Cycles, HttpRequest, TimestampMillis};

#[test]
fn icp_is_burned_into_cycles() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let start = now_millis(env);

    client::ledger::happy_path::transfer(
        env,
        *controller,
        canister_ids.icp_ledger,
        canister_ids.cycles_dispenser,
        1_000_000_000_000,
    );

    let icp_balance_e8s = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, canister_ids.cycles_dispenser);
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
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, canister_ids.cycles_dispenser);
    let new_cycles_balance = env.cycle_balance(canister_ids.cycles_dispenser.as_slice().try_into().unwrap());

    assert!(new_icp_balance_e8s < icp_balance_e8s);
    assert!(
        new_cycles_balance > cycles_balance,
        "{cycles_balance} {new_cycles_balance} {}",
        canister_ids.cycles_dispenser
    );

    // The balance is recorded either side of the CMC depositing the cycles, so it rises from one
    // sample to a later one
    let samples = cycles_balance_samples_since(env, canister_ids.cycles_dispenser, start);
    assert!(
        samples.iter().enumerate().any(|(i, before)| samples[i + 1..]
            .iter()
            .any(|after| after.cycles_balance > before.cycles_balance)),
        "{samples:?}"
    );

    // The config left behind carries on burning ICP every 5 minutes
    wrapper.discard();
}

#[test]
fn cycles_balance_is_recorded_at_midnight_in_test_mode() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let now = now_millis(env);
    let midnight = now - now % DAY_IN_MS + DAY_IN_MS;
    env.advance_time(Duration::from_millis(midnight - now));

    tick_many(env, 5);

    let samples = cycles_balance_samples_since(env, canister_ids.cycles_dispenser, midnight);
    assert!(
        samples.iter().any(|s| s.timestamp < midnight + 60_000),
        "{midnight} {samples:?}"
    );
}

#[test]
fn cycles_balance_is_recorded_at_the_start_and_end_of_an_upgrade() {
    // A new env, so that nothing else, eg. an ICP burn left configured by another test, records a
    // sample meanwhile
    let mut wrapper = ENV.deref().create_new();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    // Else the dispenser, which starts out holding ICP, burns some once it's upgraded
    client::cycles_dispenser::update_config(
        env,
        *controller,
        canister_ids.cycles_dispenser,
        &cycles_dispenser_canister::update_config::Args {
            min_cycles_balance: Some(0),
            min_interval: None,
            max_top_up_amount: None,
            icp_burn_amount: None,
        },
    );

    let start = now_millis(env);
    env.advance_time(Duration::from_millis(1));

    let wasm = wasms::CYCLES_DISPENSER.clone();
    let args = candid::encode_one(cycles_dispenser_canister::post_upgrade::Args {
        wasm_version: wasm.version,
    })
    .unwrap();
    stop_canister(env, *controller, canister_ids.cycles_dispenser);
    env.upgrade_canister(canister_ids.cycles_dispenser, wasm.module.into(), args, Some(*controller))
        .unwrap();
    start_canister(env, *controller, canister_ids.cycles_dispenser);

    // The start is recorded during the upgrade, and the end by the first timer to run after it
    tick_many(env, 3);
    let samples = cycles_balance_samples_since(env, canister_ids.cycles_dispenser, start);
    assert_eq!(samples.len(), 2, "{samples:?}");

    wrapper.discard();
}

#[derive(Deserialize, Debug)]
struct CyclesBalanceSample {
    timestamp: TimestampMillis,
    cycles_balance: Cycles,
}

fn cycles_balance_samples_since(
    env: &PocketIc,
    cycles_dispenser_canister_id: CanisterId,
    since: TimestampMillis,
) -> Vec<CyclesBalanceSample> {
    let response = client::http_request(
        env,
        Principal::anonymous(),
        cycles_dispenser_canister_id,
        &HttpRequest {
            method: "GET".to_string(),
            url: format!("/cycles_balance_samples?since={since}"),
            headers: Vec::new(),
            body: Vec::new(),
        },
    );
    assert_eq!(response.status_code, 200);

    let samples: Vec<CyclesBalanceSample> = serde_json::from_slice(&response.body).unwrap();
    assert!(samples.iter().all(|s| s.timestamp >= since), "{since} {samples:?}");
    samples
}
