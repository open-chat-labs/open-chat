use crate::model::cached_hot_groups::CachedPublicGroupSummary;
use crate::{mutate_state, read_state, RuntimeState, GROUP_CANISTER_INITIAL_CYCLES_BALANCE, MIN_CYCLES_BALANCE};
use ic_cdk_macros::heartbeat;
use types::{CanisterId, ChatId, Cycles, CyclesTopUp, Version};
use utils::canister::{self, FailedUpgrade};
use utils::consts::{CREATE_CANISTER_CYCLES_FEE, CYCLES_REQUIRED_FOR_UPGRADE};
use utils::cycles::can_spend_cycles;

const MAX_CONCURRENT_CANISTER_UPGRADES: u32 = 2;

#[heartbeat]
fn heartbeat() {
    upgrade_canisters::run();
    topup_canister_pool::run();
    calculate_hot_groups::run();
    calculate_metrics::run();
}

mod upgrade_canisters {
    use super::*;
    type CanisterToUpgrade = utils::canister::CanisterToUpgrade<group_canister::post_upgrade::Args>;

    pub fn run() {
        let chats_to_upgrade = mutate_state(next_batch);
        if !chats_to_upgrade.is_empty() {
            ic_cdk::spawn(perform_upgrades(chats_to_upgrade));
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
        let cycles_to_deposit_if_needed = if can_spend_cycles(CYCLES_REQUIRED_FOR_UPGRADE, MIN_CYCLES_BALANCE) {
            Some(CYCLES_REQUIRED_FOR_UPGRADE)
        } else {
            None
        };

        Some(CanisterToUpgrade {
            canister_id,
            current_wasm_version,
            new_wasm,
            cycles_to_deposit_if_needed,
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
        let chat_id = canister_id.into();
        let top_up = top_up.map(|c| CyclesTopUp {
            amount: c,
            date: runtime_state.env.now(),
        });

        if let Some(chat) = runtime_state.data.public_groups.get_mut(&chat_id) {
            chat.set_wasm_version(to_version);
            chat.set_upgrade_in_progress(false);
            if let Some(top_up) = top_up {
                chat.mark_cycles_top_up(top_up);
            }
        } else if let Some(chat) = runtime_state.data.private_groups.get_mut(&chat_id) {
            chat.set_wasm_version(to_version);
            chat.set_upgrade_in_progress(false);
            if let Some(top_up) = top_up {
                chat.mark_cycles_top_up(top_up);
            }
        }

        runtime_state.data.canisters_requiring_upgrade.mark_success(&canister_id);
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

mod calculate_hot_groups {
    use super::*;

    pub fn run() {
        if let Some(groups) = mutate_state(calculate_hot_groups_if_due) {
            ic_cdk::spawn(set_hot_groups(groups));
        }
    }

    fn calculate_hot_groups_if_due(runtime_state: &mut RuntimeState) -> Option<Vec<ChatId>> {
        let now = runtime_state.env.now();
        if runtime_state.data.cached_hot_groups.start_update_if_due(now) {
            let hot_groups = runtime_state.data.public_groups.calculate_hot_groups(now);

            Some(hot_groups)
        } else {
            None
        }
    }

    async fn set_hot_groups(chat_ids: Vec<ChatId>) {
        let hydrated = hydrate_hot_groups(chat_ids).await;

        mutate_state(|state| {
            let now = state.env.now();
            state.data.cached_hot_groups.update(hydrated, now);
        })
    }

    async fn hydrate_hot_groups(chat_ids: Vec<ChatId>) -> Vec<CachedPublicGroupSummary> {
        use group_canister::public_summary::{Args, Response};

        let args = Args {};

        let futures: Vec<_> = chat_ids
            .into_iter()
            .map(|chat_id| group_canister_c2c_client::public_summary(chat_id.into(), &args))
            .collect();

        let responses = futures::future::join_all(futures).await;

        responses
            .into_iter()
            .filter_map(|r| if let Ok(Response::Success(result)) = r { Some(result) } else { None })
            .map(|r| r.summary.into())
            .collect()
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
