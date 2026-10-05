use crate::env::ENV;
use crate::utils::{metrics, tick_many};
use crate::{TestEnv, client};
use candid::Principal;
use constants::{B, ICP_TRANSFER_FEE, T};
use pocket_ic::{CanisterSettings, CreateCanisterParams, CreateCanisterPlacement, PocketIc};
use std::collections::HashSet;
use std::ops::Deref;
use std::time::Duration;
use types::{CanisterId, UnitResult};

// Stands in for the old LocalGroupIndex's code, and for a live canister's
const MODULE_WAT: &str = r#"(module (memory 1))"#;

// The canisters which only the old LocalGroupIndex controls are handed over to the LocalUserIndex,
// via the call relay installed over the old LocalGroupIndex, and their cycles refunded before they
// go into the LocalUserIndex's canister pool. Then the old LocalGroupIndex's ICP is moved to the
// CyclesDispenser, and its own cycles refunded too, though it is kept. Each test discards its env,
// having added canisters to the pool, which the other tests expect to be empty.
#[test]
fn old_local_group_index_canisters_are_reclaimed_then_its_icp_moved_and_cycles_refunded() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let old_local_group_index = create_old_local_group_index(env, canister_ids.group_index, local_user_index);
    let pool_canisters: Vec<_> = (0..3)
        .map(|_| create_controlled_canister(env, old_local_group_index, local_user_index, false))
        .collect();
    let refunded = cycles_refunded(env, local_user_index);
    let pool_size = canisters_in_pool(env, local_user_index);

    let icp = 500_000_000;
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, old_local_group_index, icp);
    let cycles_dispenser_icp =
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, canister_ids.cycles_dispenser);
    let icp_burn_amount: u128 = metrics(env, canister_ids.cycles_dispenser)["icp_burn_amount"]["e8s"]
        .as_u64()
        .unwrap()
        .into();

    reclaim(
        env,
        canister_ids.group_index,
        local_user_index,
        old_local_group_index,
        &pool_canisters,
    );

    wait_for_canisters_to_be_pooled(env, &pool_canisters, local_user_index, pool_size);
    wait_for_cycles_to_be_refunded(env, old_local_group_index, local_user_index);
    assert_eq!(canisters_in_pool(env, local_user_index), pool_size + 3);

    let old = &metrics(env, local_user_index)["old_local_group_index"];
    assert_eq!(old["reclaimed"].as_u64(), Some(3));
    assert_eq!(old["skipped"].as_array().map(|s| s.len()), Some(0));
    assert_eq!(old["completed"].as_bool(), Some(true));
    assert_eq!(old["icp_found"].as_u64(), Some(icp as u64));
    assert_eq!(old["icp_moved"].as_u64(), Some((icp - ICP_TRANSFER_FEE) as u64));

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, old_local_group_index),
        0
    );
    // The CyclesDispenser burns ICP for cycles whenever its cycles balance is low, which it may do
    // meanwhile, so allow for any number of burns. The amount is read since other tests change it.
    let burn = icp_burn_amount + ICP_TRANSFER_FEE;
    let expected = cycles_dispenser_icp + icp - ICP_TRANSFER_FEE;
    let actual = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, canister_ids.cycles_dispenser);
    assert!(
        actual <= expected && (expected - actual).is_multiple_of(burn),
        "expected {expected} less some burns, got {actual}"
    );

    // Most of the old LocalGroupIndex's 10T, and of the pool canisters' 1.5T, has been refunded
    assert!(cycles_refunded(env, local_user_index) > refunded + 10 * T);

    wrapper.discard();
}

// A canister which has code is left as it is, still controlled by the old LocalGroupIndex alone
#[test]
fn canister_with_code_is_skipped() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let old_local_group_index = create_old_local_group_index(env, canister_ids.group_index, local_user_index);
    let pool_canister = create_controlled_canister(env, old_local_group_index, local_user_index, false);
    let live_canister = create_controlled_canister(env, old_local_group_index, local_user_index, true);
    let pool_size = canisters_in_pool(env, local_user_index);

    reclaim(
        env,
        canister_ids.group_index,
        local_user_index,
        old_local_group_index,
        &[pool_canister, live_canister],
    );

    wait_for_canisters_to_be_pooled(env, &[pool_canister], local_user_index, pool_size);
    wait_until_completed(env, local_user_index);

    let old = &metrics(env, local_user_index)["old_local_group_index"];
    assert_eq!(old["reclaimed"].as_u64(), Some(1));
    assert_eq!(old["skipped"][0].as_str(), Some(live_canister.to_text().as_str()));

    tick_many(env, 20);
    let status = env.canister_status(live_canister, Some(old_local_group_index)).unwrap();
    assert_eq!(status.settings.controllers, vec![old_local_group_index]);
    assert!(status.module_hash.is_some());
    wait_for_cycles_to_be_refunded(env, old_local_group_index, local_user_index);

    wrapper.discard();
}

// A canister already controlled by the LocalUserIndex alone, as if handed over by an earlier attempt
// whose outcome was lost, counts as reclaimed. One controlled by neither is skipped, as is one which
// the LocalUserIndex controls along with another controller. A repeated request while a batch is in
// flight changes nothing.
#[test]
fn canister_already_handed_over_is_reclaimed_and_one_controlled_by_neither_skipped() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let local_user_index = client::user_index::happy_path::user_registration_canister(env, canister_ids.user_index);
    let old_local_group_index = create_old_local_group_index(env, canister_ids.group_index, local_user_index);
    // More than a batch of them
    let pool_canisters: Vec<_> = (0..11)
        .map(|_| create_controlled_canister(env, old_local_group_index, local_user_index, false))
        .collect();
    let already_handed_over = create_on_subnet(env, local_user_index, vec![local_user_index], 500 * B);
    let controlled_by_neither = create_on_subnet(env, local_user_index, vec![*controller], 500 * B);
    let with_another_controller = create_on_subnet(env, local_user_index, vec![local_user_index, *controller], 500 * B);
    let all: Vec<_> = pool_canisters
        .iter()
        .copied()
        .chain([already_handed_over, controlled_by_neither, with_another_controller])
        .collect();
    let pool_size = canisters_in_pool(env, local_user_index);

    reclaim(env, canister_ids.group_index, local_user_index, old_local_group_index, &all);
    tick_many(env, 3);
    reclaim(env, canister_ids.group_index, local_user_index, old_local_group_index, &all);

    let reclaimed: Vec<_> = pool_canisters.iter().copied().chain([already_handed_over]).collect();
    wait_for_canisters_to_be_pooled(env, &reclaimed, local_user_index, pool_size);
    wait_until_completed(env, local_user_index);

    let old = &metrics(env, local_user_index)["old_local_group_index"];
    assert_eq!(old["reclaimed"].as_u64(), Some(12));
    let skipped: HashSet<_> = old["skipped"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| c.as_str().unwrap().to_string())
        .collect();
    assert_eq!(
        skipped,
        HashSet::from([controlled_by_neither.to_text(), with_another_controller.to_text()])
    );

    let status = env.canister_status(controlled_by_neither, Some(*controller)).unwrap();
    assert_eq!(status.settings.controllers, vec![*controller]);
    let status = env.canister_status(with_another_controller, Some(*controller)).unwrap();
    assert_eq!(status.settings.controllers.len(), 2);
    assert_eq!(canisters_in_pool(env, local_user_index), pool_size + 12);
    wait_for_cycles_to_be_refunded(env, old_local_group_index, local_user_index);

    wrapper.discard();
}

fn reclaim(
    env: &mut PocketIc,
    group_index: CanisterId,
    local_user_index: CanisterId,
    old_local_group_index: CanisterId,
    canister_ids: &[CanisterId],
) {
    let response = client::local_user_index::c2c_reclaim_old_local_group_index(
        env,
        group_index,
        local_user_index,
        &local_user_index_canister::c2c_reclaim_old_local_group_index::Args {
            local_group_index_canister_id: old_local_group_index,
            canister_ids: canister_ids.to_vec(),
        },
    );
    assert!(matches!(response, UnitResult::Success), "{response:?}");
}

// As the GroupIndex leaves it: with code, and the LocalUserIndex as a controller alongside the
// GroupIndex
fn create_old_local_group_index(env: &mut PocketIc, group_index: CanisterId, local_user_index: CanisterId) -> CanisterId {
    let canister_id = create_on_subnet(env, local_user_index, vec![group_index, local_user_index], 10 * T);
    env.install_canister(canister_id, module(), Vec::new(), Some(group_index));
    canister_id
}

// Controlled by the old LocalGroupIndex alone, as its pool canisters were
fn create_controlled_canister(
    env: &mut PocketIc,
    old_local_group_index: CanisterId,
    local_user_index: CanisterId,
    with_code: bool,
) -> CanisterId {
    let canister_id = create_on_subnet(env, local_user_index, vec![old_local_group_index], 500 * B);
    if with_code {
        env.install_canister(canister_id, module(), Vec::new(), Some(old_local_group_index));
    }
    canister_id
}

fn create_on_subnet(env: &mut PocketIc, local_user_index: CanisterId, controllers: Vec<Principal>, cycles: u128) -> CanisterId {
    let subnet_id = env.get_subnet(local_user_index).unwrap();
    env.create_canister_with_params(
        Some(controllers[0]),
        CreateCanisterParams {
            cycles: Some(cycles),
            settings: Some(CanisterSettings {
                controllers: Some(controllers),
                ..Default::default()
            }),
            placement: Some(CreateCanisterPlacement::SubnetId(subnet_id)),
        },
    )
    .unwrap()
}

// The reclaimed canisters' cycles are counted as from pool canisters, the old LocalGroupIndex's as
// from a deleted user's canister
fn cycles_refunded(env: &PocketIc, local_user_index: CanisterId) -> u128 {
    let metrics = metrics(env, local_user_index);
    ["cycles_refunded_from_deleted_users", "cycles_refunded_from_pool_canisters"]
        .iter()
        .map(|key| u128::from(metrics[key].as_u64().unwrap()))
        .sum()
}

fn canisters_in_pool(env: &PocketIc, local_user_index: CanisterId) -> u64 {
    metrics(env, local_user_index)["canisters_in_pool"].as_u64().unwrap()
}

// Each canister is controlled by the LocalUserIndex alone, has had its cycles refunded, and is in the
// canister pool, which nothing else adds to in the tests
fn wait_for_canisters_to_be_pooled(
    env: &mut PocketIc,
    canister_ids: &[CanisterId],
    local_user_index: CanisterId,
    pool_size: u64,
) {
    for _ in 0..100 {
        if canisters_in_pool(env, local_user_index) >= pool_size + canister_ids.len() as u64
            && canister_ids.iter().all(|c| {
                let status = env.canister_status(*c, Some(local_user_index)).unwrap();
                status.settings.controllers == vec![local_user_index]
                    && status.module_hash.is_none()
                    && env.cycle_balance(*c) < 200 * B
            })
        {
            return;
        }
        env.advance_time(Duration::from_secs(10));
        tick_many(env, 5);
    }
    panic!("The reclaimed canisters weren't refunded and put into the pool");
}

// The relay is uninstalled when the old LocalGroupIndex's cycles are refunded, but it is kept
fn wait_for_cycles_to_be_refunded(env: &mut PocketIc, old_local_group_index: CanisterId, local_user_index: CanisterId) {
    for _ in 0..100 {
        let status = env.canister_status(old_local_group_index, Some(local_user_index)).unwrap();
        if status.module_hash.is_none() && env.cycle_balance(old_local_group_index) < T {
            return;
        }
        env.advance_time(Duration::from_secs(10));
        tick_many(env, 5);
    }
    panic!("The old LocalGroupIndex's cycles weren't refunded");
}

fn wait_until_completed(env: &mut PocketIc, local_user_index: CanisterId) {
    for _ in 0..100 {
        if metrics(env, local_user_index)["old_local_group_index"]["completed"].as_bool() == Some(true) {
            return;
        }
        env.advance_time(Duration::from_secs(10));
        tick_many(env, 5);
    }
    panic!("Reclaiming the old LocalGroupIndex's canisters didn't complete");
}

fn module() -> Vec<u8> {
    wat::parse_str(MODULE_WAT).unwrap()
}
