use crate::reinstall_group::GroupBeingReinstalled;
use canister_state_macros::canister_state;
use model::local_group_map::LocalGroupMap;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use types::{CanisterId, CanisterWasm, Cycles, Milliseconds, TimestampMillis, Timestamped, UserId, Version};
use utils::canister;
use utils::canister::{CanistersRequiringUpgrade, FailedUpgradeCount};
use utils::consts::CYCLES_REQUIRED_FOR_UPGRADE;
use utils::env::Environment;

mod guards;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod reinstall_group;
mod updates;

const GROUP_CANISTER_INITIAL_CYCLES_BALANCE: Cycles = CYCLES_REQUIRED_FOR_UPGRADE + GROUP_CANISTER_TOP_UP_AMOUNT; // 0.18T cycles
const GROUP_CANISTER_TOP_UP_AMOUNT: Cycles = 100_000_000_000; // 0.1T cycles
const MARK_ACTIVE_DURATION: Milliseconds = 10 * 60 * 1000; // 10 minutes

thread_local! {
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

    pub fn is_caller_group_index_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.group_index_canister_id == caller
    }

    pub fn is_caller_local_group_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.local_groups.get(&caller.into()).is_some()
    }

    pub fn is_caller_notifications_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.notifications_canister_id == caller
    }

    pub fn metrics(&self) -> Metrics {
        let canister_upgrades_metrics = self.data.canisters_requiring_upgrade.metrics();
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            total_cycles_spent_on_canisters: self.data.total_cycles_spent_on_canisters,
            canisters_in_pool: self.data.canister_pool.len() as u16,
            local_group_count: self.data.local_groups.len() as u64,
            canister_upgrades_completed: canister_upgrades_metrics.completed,
            canister_upgrades_failed: canister_upgrades_metrics.failed,
            canister_upgrades_pending: canister_upgrades_metrics.pending as u64,
            canister_upgrades_in_progress: canister_upgrades_metrics.in_progress as u64,
            group_wasm_version: self.data.group_canister_wasm.version,
            max_concurrent_canister_upgrades: self.data.max_concurrent_canister_upgrades,
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                group_index: self.data.group_index_canister_id,
                local_user_index: self.data.local_user_index_canister_id,
                notifications: self.data.notifications_canister_id,
                proposals_bot: self.data.proposals_bot_user_id.into(),
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub local_groups: LocalGroupMap,
    pub group_canister_wasm: CanisterWasm,
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub canisters_requiring_upgrade: CanistersRequiringUpgrade,
    pub cycles_dispenser_canister_id: CanisterId,
    pub proposals_bot_user_id: UserId,
    pub canister_pool: canister::Pool,
    pub total_cycles_spent_on_canisters: Cycles,
    pub test_mode: bool,
    pub max_concurrent_canister_upgrades: u32,
    #[serde(default)]
    pub group_being_reinstalled: Option<GroupBeingReinstalled>,
}

impl Data {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        group_canister_wasm: CanisterWasm,
        user_index_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        notifications_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        proposals_bot_user_id: UserId,
        canister_pool_target_size: u16,
        test_mode: bool,
    ) -> Self {
        Data {
            local_groups: LocalGroupMap::default(),
            group_canister_wasm,
            user_index_canister_id,
            local_user_index_canister_id,
            group_index_canister_id,
            notifications_canister_id,
            cycles_dispenser_canister_id,
            proposals_bot_user_id,
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            canister_pool: canister::Pool::new(canister_pool_target_size),
            total_cycles_spent_on_canisters: 0,
            test_mode,
            max_concurrent_canister_upgrades: 2,
            group_being_reinstalled: None,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub memory_used: u64,
    pub now: TimestampMillis,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub git_commit_id: String,
    pub total_cycles_spent_on_canisters: Cycles,
    pub local_group_count: u64,
    pub canisters_in_pool: u16,
    pub canister_upgrades_completed: u64,
    pub canister_upgrades_failed: Vec<FailedUpgradeCount>,
    pub canister_upgrades_pending: u64,
    pub canister_upgrades_in_progress: u64,
    pub group_wasm_version: Version,
    pub max_concurrent_canister_upgrades: u32,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub local_user_index: CanisterId,
    pub notifications: CanisterId,
    pub proposals_bot: CanisterId,
    pub cycles_dispenser: CanisterId,
}
