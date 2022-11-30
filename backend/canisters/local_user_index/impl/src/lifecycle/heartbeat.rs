use crate::{mutate_state, read_state, RuntimeState, USER_CANISTER_INITIAL_CYCLES_BALANCE};
use ic_cdk_macros::heartbeat;
use types::{CanisterId, Cycles, CyclesTopUp, UserId, Version};
use utils::canister::{self, FailedUpgrade};
use utils::consts::{CREATE_CANISTER_CYCLES_FEE, CYCLES_REQUIRED_FOR_UPGRADE, MIN_CYCLES_BALANCE};
use utils::cycles::can_spend_cycles;

#[heartbeat]
fn heartbeat() {
    upgrade_canisters::run();
    topup_canister_pool::run();
    cycles_dispenser_client::run();
}

mod upgrade_canisters {
    use super::*;
    type CanisterToUpgrade = utils::canister::CanisterToUpgrade<user_canister::post_upgrade::Args>;

    pub fn run() {
        let canisters_to_upgrade = mutate_state(next_batch);
        if !canisters_to_upgrade.is_empty() {
            ic_cdk::spawn(perform_upgrades(canisters_to_upgrade));
        }
    }

    fn next_batch(runtime_state: &mut RuntimeState) -> Vec<CanisterToUpgrade> {
        let count_in_progress = runtime_state.data.canisters_requiring_upgrade.count_in_progress();
        let max_concurrent_canister_upgrades = runtime_state.data.max_concurrent_canister_upgrades;

        (0..(max_concurrent_canister_upgrades.saturating_sub(count_in_progress)))
            .map_while(|_| try_get_next(runtime_state))
            .collect()
    }

    fn try_get_next(runtime_state: &mut RuntimeState) -> Option<CanisterToUpgrade> {
        let canister_id = runtime_state.data.canisters_requiring_upgrade.try_take_next()?;

        initialize_upgrade(canister_id, runtime_state).or_else(|| {
            runtime_state.data.canisters_requiring_upgrade.mark_skipped(&canister_id);
            None
        })
    }

    fn initialize_upgrade(canister_id: CanisterId, runtime_state: &mut RuntimeState) -> Option<CanisterToUpgrade> {
        let user_id = canister_id.into();
        let mut user = runtime_state.data.local_users.get(&user_id)?;
        let current_wasm_version = user.wasm_version;
        let user_canister_wasm = &runtime_state.data.user_canister_wasm;
        let date_created = user.date_created;

        user.set_canister_upgrade_status(true, None);

        let cycles_to_deposit_if_needed = if can_spend_cycles(CYCLES_REQUIRED_FOR_UPGRADE, MIN_CYCLES_BALANCE) {
            Some(CYCLES_REQUIRED_FOR_UPGRADE)
        } else {
            None
        };

        Some(CanisterToUpgrade {
            canister_id,
            current_wasm_version,
            new_wasm: user_canister_wasm.clone(),
            cycles_to_deposit_if_needed,
            args: user_canister::post_upgrade::Args {
                wasm_version: user_canister_wasm.version,
                date_created,
            },
        })
    }

    async fn perform_upgrades(canisters_to_upgrade: Vec<CanisterToUpgrade>) {
        let futures: Vec<_> = canisters_to_upgrade.into_iter().map(perform_upgrade).collect();

        futures::future::join_all(futures).await;
    }

    async fn perform_upgrade(canister_to_upgrade: CanisterToUpgrade) {
        let canister_id = canister_to_upgrade.canister_id;
        let from_version = canister_to_upgrade.current_wasm_version;
        let to_version = canister_to_upgrade.new_wasm.version;

        match canister::upgrade(canister_to_upgrade).await {
            Ok(cycles_top_up) => {
                mutate_state(|state| on_success(canister_id, to_version, cycles_top_up, state));
            }
            Err(_) => {
                mutate_state(|state| on_failure(canister_id, from_version, to_version, state));
            }
        }
    }

    fn on_success(canister_id: CanisterId, to_version: Version, top_up: Option<Cycles>, runtime_state: &mut RuntimeState) {
        let user_id = canister_id.into();
        mark_upgrade_complete(user_id, Some(to_version), runtime_state);

        if let Some(top_up) = top_up {
            runtime_state.data.local_users.mark_cycles_top_up(
                &user_id,
                CyclesTopUp {
                    amount: top_up,
                    date: runtime_state.env.now(),
                },
            );
        }

        runtime_state.data.canisters_requiring_upgrade.mark_success(&canister_id);
    }

    fn on_failure(canister_id: CanisterId, from_version: Version, to_version: Version, runtime_state: &mut RuntimeState) {
        mark_upgrade_complete(canister_id.into(), None, runtime_state);

        runtime_state.data.canisters_requiring_upgrade.mark_failure(FailedUpgrade {
            canister_id,
            from_version,
            to_version,
        });
    }

    fn mark_upgrade_complete(user_id: UserId, new_wasm_version: Option<Version>, runtime_state: &mut RuntimeState) {
        if let Some(mut user) = runtime_state.data.local_users.get(&user_id) {
            user.set_canister_upgrade_status(false, new_wasm_version);
        }
    }
}

mod topup_canister_pool {
    use super::*;

    pub fn run() {
        let is_full = read_state(is_pool_full);
        if !is_full {
            let cycles_to_use = USER_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;

            // Only create the new canister if it won't result in the cycles balance being too low
            if utils::cycles::can_spend_cycles(cycles_to_use, MIN_CYCLES_BALANCE) {
                ic_cdk::spawn(add_new_canister(cycles_to_use));
            }
        }
    }

    fn is_pool_full(runtime_state: &RuntimeState) -> bool {
        runtime_state.data.canister_pool.is_full()
    }

    async fn add_new_canister(cycles_to_use: Cycles) {
        if let Ok(canister_id) = canister::create(cycles_to_use).await {
            mutate_state(|state| add_canister_to_pool(canister_id, cycles_to_use, state));
        }
    }

    fn add_canister_to_pool(canister_id: CanisterId, cycles: Cycles, runtime_state: &mut RuntimeState) {
        runtime_state.data.canister_pool.push(canister_id);
        runtime_state.data.total_cycles_spent_on_canisters += cycles;
    }
}