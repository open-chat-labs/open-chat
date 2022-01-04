use crate::{mutate_state, read_state, RuntimeState, GROUP_CANISTER_INITIAL_CYCLES_BALANCE, MIN_CYCLES_BALANCE};
use ic_cdk_macros::heartbeat;
use types::{CanisterId, Cycles, Version};
use utils::canister::{self, FailedUpgrade};
use utils::consts::CREATE_CANISTER_CYCLES_FEE;

const MAX_CONCURRENT_CANISTER_UPGRADES: u32 = 5;

#[heartbeat]
fn heartbeat() {
    upgrade_canisters::run();
    topup_canister_pool::run();
    calculate_metrics::run();
}

mod upgrade_canisters {
    use super::*;
    type CanisterToUpgrade = utils::canister::CanisterToUpgrade<group_canister::post_upgrade::Args>;

    pub fn run() {
        let chats_to_upgrade = mutate_state(next_batch);
        if !chats_to_upgrade.is_empty() {
            ic_cdk::block_on(perform_upgrades(chats_to_upgrade));
        }
    }

    fn next_batch(runtime_state: &mut RuntimeState) -> Vec<CanisterToUpgrade> {
        let count_in_progress = runtime_state.data.canisters_requiring_upgrade.count_in_progress();
        (0..(MAX_CONCURRENT_CANISTER_UPGRADES - count_in_progress))
            // TODO replace this with 'map_while' once we have upgraded to Rust 1.57
            .map(|_| try_get_next(runtime_state))
            .take_while(|c| c.is_some())
            .map(|c| c.unwrap())
            .collect()
    }

    fn try_get_next(runtime_state: &mut RuntimeState) -> Option<CanisterToUpgrade> {
        let canister_id = runtime_state.data.canisters_requiring_upgrade.try_take_next()?;
        let chat_id = canister_id.into();

        let current_wasm_version: Version;
        if let Some(chat) = runtime_state.data.public_groups.get_mut(&chat_id) {
            chat.set_upgrade_in_progress(true);
            current_wasm_version = chat.wasm_version();
        } else if let Some(chat) = runtime_state.data.private_groups.get_mut(&chat_id) {
            chat.set_upgrade_in_progress(true);
            current_wasm_version = chat.wasm_version();
        } else {
            return None;
        }

        let new_wasm = runtime_state.data.group_canister_wasm.clone();
        let wasm_version = new_wasm.version;

        Some(CanisterToUpgrade {
            canister_id,
            current_wasm_version,
            new_wasm,
            args: group_canister::post_upgrade::Args { wasm_version },
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

        match canister::upgrade(canister_id, canister_to_upgrade.new_wasm.module, canister_to_upgrade.args).await {
            Ok(_) => {
                mutate_state(|state| on_success(canister_id, to_version, state));
            }
            Err(_) => {
                mutate_state(|state| on_failure(canister_id, from_version, to_version, state));
            }
        }
    }

    fn on_success(canister_id: CanisterId, to_version: Version, runtime_state: &mut RuntimeState) {
        let chat_id = canister_id.into();
        runtime_state.data.canisters_requiring_upgrade.mark_success(&canister_id);

        if let Some(chat) = runtime_state.data.public_groups.get_mut(&chat_id) {
            chat.set_wasm_version(to_version);
            chat.set_upgrade_in_progress(false);
        } else if let Some(chat) = runtime_state.data.private_groups.get_mut(&chat_id) {
            chat.set_wasm_version(to_version);
            chat.set_upgrade_in_progress(false);
        }
    }

    fn on_failure(canister_id: CanisterId, from_version: Version, to_version: Version, runtime_state: &mut RuntimeState) {
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
        let is_full = read_state(is_pool_full);
        if !is_full {
            let cycles_to_use = GROUP_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;

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
            mutate_state(|state| add_canister_to_pool(canister_id, cycles_to_use, state));
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
        mutate_state(calculate_metrics);
    }

    fn calculate_metrics(runtime_state: &mut RuntimeState) {
        let now = runtime_state.env.now();
        runtime_state.data.calculate_metrics(now);
    }
}
