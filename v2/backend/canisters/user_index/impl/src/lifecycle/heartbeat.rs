use crate::updates::upgrade_canister::{initialize_upgrade, set_upgrade_complete};
use crate::{RuntimeState, MIN_CYCLES_BALANCE, RUNTIME_STATE, USER_CANISTER_INITIAL_CYCLES_BALANCE};
use ic_cdk_macros::heartbeat;
use types::{CanisterId, Cycles, Version};
use utils::canister;
use utils::canister::{CanisterToUpgrade, FailedUpgrade};
use utils::consts::CREATE_CANISTER_CYCLES_FEE;

const MAX_CANISTER_UPGRADES_PER_HEARTBEAT: u32 = 3;

#[heartbeat]
fn heartbeat() {
    upgrade_canisters::run();
    topup_canister_pool::run();
    calculate_metrics::run();
}

mod upgrade_canisters {
    use super::*;

    pub fn run() {
        let canisters_to_upgrade = RUNTIME_STATE.with(|state| get_next_batch(state.borrow_mut().as_mut().unwrap()));
        if !canisters_to_upgrade.is_empty() {
            ic_cdk::block_on(perform_upgrades(canisters_to_upgrade));
        }
    }

    fn get_next_batch(runtime_state: &mut RuntimeState) -> Vec<CanisterToUpgrade> {
        (0..MAX_CANISTER_UPGRADES_PER_HEARTBEAT)
            // TODO replace this with 'map_while' once we have upgraded to Rust 1.57
            .map(|_| try_get_next(runtime_state))
            .take_while(|c| c.is_some())
            .map(|c| c.unwrap())
            .collect()
    }

    fn try_get_next(runtime_state: &mut RuntimeState) -> Option<CanisterToUpgrade> {
        let canister_id = runtime_state.data.canisters_requiring_upgrade.try_take_next()?;

        initialize_upgrade(Some(canister_id.into()), runtime_state).ok()
    }

    async fn perform_upgrades(canisters_to_upgrade: Vec<CanisterToUpgrade>) {
        let futures: Vec<_> = canisters_to_upgrade.into_iter().map(perform_upgrade).collect();

        futures::future::join_all(futures).await;
    }

    async fn perform_upgrade(canister_to_upgrade: CanisterToUpgrade) {
        let canister_id = canister_to_upgrade.canister_id;
        let from_version = canister_to_upgrade.current_wasm_version;
        let to_version = canister_to_upgrade.new_wasm.version;

        match canister::upgrade(canister_id, canister_to_upgrade.new_wasm.module).await {
            Ok(_) => {
                RUNTIME_STATE.with(|state| on_success(canister_id, to_version, state.borrow_mut().as_mut().unwrap()));
            }
            Err(_) => {
                RUNTIME_STATE
                    .with(|state| on_failure(canister_id, from_version, to_version, state.borrow_mut().as_mut().unwrap()));
            }
        }
    }

    fn on_success(canister_id: CanisterId, to_version: Version, runtime_state: &mut RuntimeState) {
        set_upgrade_complete(canister_id.into(), Some(to_version), runtime_state);
        runtime_state.data.canisters_requiring_upgrade.mark_success(&canister_id);
    }

    fn on_failure(canister_id: CanisterId, from_version: Version, to_version: Version, runtime_state: &mut RuntimeState) {
        set_upgrade_complete(canister_id.into(), None, runtime_state);
        runtime_state.data.canisters_requiring_upgrade.mark_failure(FailedUpgrade {
            canister_id,
            from_version,
            to_version,
        });
    }
}

mod topup_canister_pool {
    use super::*;

    pub fn run() {
        let is_full = RUNTIME_STATE.with(|state| is_pool_full(state.borrow().as_ref().unwrap()));
        if !is_full {
            let cycles_to_use = USER_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;

            // Only create the new canister if it won't result in the cycles balance being too low
            if cycles_utils::can_spend_cycles(cycles_to_use, MIN_CYCLES_BALANCE) {
                ic_cdk::block_on(add_new_canister(cycles_to_use));
            }
        }
    }

    fn is_pool_full(runtime_state: &RuntimeState) -> bool {
        runtime_state.data.canister_pool.is_full()
    }

    async fn add_new_canister(cycles_to_use: Cycles) {
        if let Ok(canister_id) = canister::create(cycles_to_use).await {
            RUNTIME_STATE.with(|state| add_canister_to_pool(canister_id, cycles_to_use, state.borrow_mut().as_mut().unwrap()));
        }
    }

    fn add_canister_to_pool(canister_id: CanisterId, cycles: Cycles, runtime_state: &mut RuntimeState) {
        runtime_state.data.canister_pool.push(canister_id);
        runtime_state.data.total_cycles_spent_on_canisters += cycles;
    }
}

mod calculate_metrics {
    use super::*;

    pub fn run() {
        RUNTIME_STATE.with(|state| calculate_metrics(state.borrow_mut().as_mut().unwrap()));
    }

    fn calculate_metrics(runtime_state: &mut RuntimeState) {
        let now = runtime_state.env.now();
        runtime_state.data.users.calculate_metrics(now);
    }
}
