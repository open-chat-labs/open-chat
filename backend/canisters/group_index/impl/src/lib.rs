use crate::model::cached_hot_groups::CachedHotGroups;
use crate::model::deleted_groups::DeletedGroups;
use crate::model::private_groups::PrivateGroups;
use crate::model::public_groups::PublicGroups;
use candid::{CandidType, Principal};
use canister_logger::LogMessagesWrapper;
use canister_state_macros::canister_state;
use model::canisters_requiring_controller_swap::CanistersRequiringControllerSwap;
use model::local_group_index_map::LocalGroupIndexMap;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use types::{CanisterId, CanisterWasm, Cycles, Milliseconds, TimestampMillis, Timestamped, Version};
use utils::canister::{CanistersRequiringUpgrade, FailedUpgradeCount};
use utils::env::Environment;
use utils::memory;
use utils::time::MINUTE_IN_MS;

mod guards;
mod lifecycle;
mod model;
mod queries;
mod updates;

const LOCAL_GROUP_INDEX_CANISTER_TOP_UP_AMOUNT: Cycles = 25_000_000_000_000; // 25T cycles
const MARK_ACTIVE_DURATION: Milliseconds = 10 * 60 * 1000; // 10 minutes
const FIVE_MINUTES_IN_MS: Milliseconds = MINUTE_IN_MS * 5;
const CACHED_HOT_GROUPS_COUNT: usize = 40;

thread_local! {
    static LOG_MESSAGES: RefCell<LogMessagesWrapper> = RefCell::default();
    static WASM_VERSION: RefCell<Timestamped<Version>> = RefCell::default();
}

canister_state!(RuntimeState);

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn is_caller_service_principal(&self) -> bool {
        let caller = self.env.caller();
        self.data.service_principals.contains(&caller)
    }

    pub fn metrics(&self) -> Metrics {
        let canister_upgrades_metrics = self.data.canisters_requiring_upgrade.metrics();
        let canister_swap_controller_metrics = self.data.canisters_requiring_controller_swap.metrics();

        Metrics {
            memory_used: memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            total_cycles_spent_on_canisters: self.data.total_cycles_spent_on_canisters,
            public_groups: self.data.public_groups.len() as u32,
            private_groups: self.data.private_groups.len() as u64,
            active_public_groups: self.data.cached_metrics.active_public_groups,
            active_private_groups: self.data.cached_metrics.active_private_groups,
            deleted_public_groups: self.data.cached_metrics.deleted_public_groups,
            deleted_private_groups: self.data.cached_metrics.deleted_private_groups,
            group_deleted_notifications_pending: self.data.cached_metrics.group_deleted_notifications_pending,
            canister_upgrades_completed: canister_upgrades_metrics.completed,
            canister_upgrades_failed: canister_upgrades_metrics.failed,
            canister_upgrades_pending: canister_upgrades_metrics.pending as u64,
            canister_upgrades_in_progress: canister_upgrades_metrics.in_progress as u64,
            group_wasm_version: self.data.group_canister_wasm.version,
            local_group_index_wasm_version: self.data.local_group_index_canister_wasm.version,
            max_concurrent_local_group_index_canister_upgrades: self.data.max_concurrent_local_group_index_canister_upgrades,
            canister_controllers_swaps_completed: canister_swap_controller_metrics.completed,
            canister_controllers_swaps_failed: canister_swap_controller_metrics.failed,
            canister_controllers_swaps_pending: canister_swap_controller_metrics.pending,
            canister_controllers_swaps_in_progress: canister_swap_controller_metrics.in_progress,
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub public_groups: PublicGroups,
    pub private_groups: PrivateGroups,
    pub deleted_groups: DeletedGroups,
    pub service_principals: HashSet<Principal>,
    pub group_canister_wasm: CanisterWasm,
    pub local_group_index_canister_wasm: CanisterWasm,
    pub notifications_canister_ids: Vec<CanisterId>,
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub ledger_canister_id: CanisterId,
    pub canisters_requiring_upgrade: CanistersRequiringUpgrade,
    pub test_mode: bool,
    pub total_cycles_spent_on_canisters: Cycles,
    pub cached_hot_groups: CachedHotGroups,
    pub cached_metrics: CachedMetrics,
    pub max_concurrent_local_group_index_canister_upgrades: usize,
    pub local_index_map: LocalGroupIndexMap,
    pub canisters_requiring_controller_swap: CanistersRequiringControllerSwap,
}

impl Data {
    #[allow(clippy::too_many_arguments)]
    fn new(
        service_principals: Vec<Principal>,
        group_canister_wasm: CanisterWasm,
        local_group_index_canister_wasm: CanisterWasm,
        notifications_canister_ids: Vec<CanisterId>,
        user_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        ledger_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            public_groups: PublicGroups::default(),
            private_groups: PrivateGroups::default(),
            deleted_groups: DeletedGroups::default(),
            service_principals: service_principals.into_iter().collect(),
            group_canister_wasm,
            local_group_index_canister_wasm,
            notifications_canister_ids,
            user_index_canister_id,
            cycles_dispenser_canister_id,
            ledger_canister_id,
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            test_mode,
            total_cycles_spent_on_canisters: 0,
            cached_hot_groups: CachedHotGroups::default(),
            cached_metrics: CachedMetrics::default(),
            max_concurrent_local_group_index_canister_upgrades: 1,
            local_index_map: LocalGroupIndexMap::default(),
            canisters_requiring_controller_swap: CanistersRequiringControllerSwap::default(),
        }
    }

    pub fn calculate_metrics(&mut self, now: TimestampMillis) {
        // Throttle to once every 5 minutes
        if now < self.cached_metrics.last_run + FIVE_MINUTES_IN_MS {
            return;
        }

        let deleted_group_metrics = self.deleted_groups.metrics();

        let mut cached_metrics = CachedMetrics {
            last_run: now,
            deleted_public_groups: deleted_group_metrics.public,
            deleted_private_groups: deleted_group_metrics.private,
            group_deleted_notifications_pending: deleted_group_metrics.notifications_pending,
            ..Default::default()
        };

        for public_group in self.public_groups.iter() {
            if public_group.has_been_active_since(now) {
                cached_metrics.active_public_groups += 1;
            }
        }

        for private_group in self.private_groups.iter() {
            if private_group.has_been_active_since(now) {
                cached_metrics.active_private_groups += 1;
            }
        }

        self.cached_metrics = cached_metrics;
    }
}

#[cfg(test)]
impl Default for Data {
    fn default() -> Data {
        Data {
            public_groups: PublicGroups::default(),
            private_groups: PrivateGroups::default(),
            deleted_groups: DeletedGroups::default(),
            service_principals: HashSet::default(),
            group_canister_wasm: CanisterWasm::default(),
            local_group_index_canister_wasm: CanisterWasm::default(),
            notifications_canister_ids: vec![Principal::anonymous()],
            user_index_canister_id: Principal::anonymous(),
            cycles_dispenser_canister_id: Principal::anonymous(),
            ledger_canister_id: Principal::anonymous(),
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            test_mode: true,
            total_cycles_spent_on_canisters: 0,
            cached_hot_groups: CachedHotGroups::default(),
            cached_metrics: CachedMetrics::default(),
            max_concurrent_local_group_index_canister_upgrades: 1,
            local_index_map: LocalGroupIndexMap::default(),
            canisters_requiring_controller_swap: CanistersRequiringControllerSwap::default(),
        }
    }
}

#[derive(CandidType, Serialize, Debug)]
pub struct Metrics {
    pub memory_used: u64,
    pub now: TimestampMillis,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub git_commit_id: String,
    pub total_cycles_spent_on_canisters: Cycles,
    pub public_groups: u32,
    pub private_groups: u64,
    pub active_public_groups: u64,
    pub active_private_groups: u64,
    pub deleted_public_groups: u64,
    pub deleted_private_groups: u64,
    pub group_deleted_notifications_pending: u64,
    pub canister_upgrades_completed: u64,
    pub canister_upgrades_failed: Vec<FailedUpgradeCount>,
    pub canister_upgrades_pending: u64,
    pub canister_upgrades_in_progress: u64,
    pub group_wasm_version: Version,
    pub local_group_index_wasm_version: Version,
    pub max_concurrent_local_group_index_canister_upgrades: usize,
    pub canister_controllers_swaps_completed: usize,
    pub canister_controllers_swaps_failed: usize,
    pub canister_controllers_swaps_pending: usize,
    pub canister_controllers_swaps_in_progress: usize,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
pub struct CachedMetrics {
    pub last_run: TimestampMillis,
    pub active_public_groups: u64,
    pub active_private_groups: u64,
    pub deleted_public_groups: u64,
    pub deleted_private_groups: u64,
    pub group_deleted_notifications_pending: u64,
}
