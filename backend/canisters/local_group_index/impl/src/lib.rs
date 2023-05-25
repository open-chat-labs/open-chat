use crate::model::local_community_map::LocalCommunityMap;
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
mod updates;

const GROUP_CANISTER_INITIAL_CYCLES_BALANCE: Cycles = CYCLES_REQUIRED_FOR_UPGRADE + GROUP_CANISTER_TOP_UP_AMOUNT; // 0.18T cycles
const COMMUNITY_CANISTER_INITIAL_CYCLES_BALANCE: Cycles = GROUP_CANISTER_INITIAL_CYCLES_BALANCE;
const GROUP_CANISTER_TOP_UP_AMOUNT: Cycles = 100_000_000_000; // 0.1T cycles
const COMMUNITY_CANISTER_TOP_UP_AMOUNT: Cycles = GROUP_CANISTER_TOP_UP_AMOUNT;
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

    pub fn is_caller_local_community_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.local_communities.get(&caller.into()).is_some()
    }

    pub fn is_caller_notifications_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.notifications_canister_id == caller
    }

    pub fn metrics(&self) -> Metrics {
        let group_upgrades_metrics = self.data.groups_requiring_upgrade.metrics();
        let community_upgrades_metrics = self.data.communities_requiring_upgrade.metrics();

        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            total_cycles_spent_on_canisters: self.data.total_cycles_spent_on_canisters,
            canisters_in_pool: self.data.canister_pool.len() as u16,
            local_group_count: self.data.local_groups.len() as u64,
            local_community_count: self.data.local_communities.len() as u64,
            group_upgrades_completed: group_upgrades_metrics.completed,
            group_upgrades_failed: group_upgrades_metrics.failed,
            group_upgrades_pending: group_upgrades_metrics.pending as u64,
            group_upgrades_in_progress: group_upgrades_metrics.in_progress as u64,
            community_upgrades_completed: community_upgrades_metrics.completed,
            community_upgrades_failed: community_upgrades_metrics.failed,
            community_upgrades_pending: community_upgrades_metrics.pending as u64,
            community_upgrades_in_progress: community_upgrades_metrics.in_progress as u64,
            group_wasm_version: self.data.group_canister_wasm_for_new_canisters.version,
            community_wasm_version: self.data.community_canister_wasm_for_new_canisters.version,
            max_concurrent_group_upgrades: self.data.max_concurrent_group_upgrades,
            group_upgrade_concurrency: self.data.group_upgrade_concurrency,
            max_concurrent_community_upgrades: self.data.max_concurrent_community_upgrades,
            community_upgrade_concurrency: self.data.community_upgrade_concurrency,
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
    #[serde(default)]
    pub local_communities: LocalCommunityMap,
    pub group_canister_wasm_for_new_canisters: CanisterWasm,
    pub group_canister_wasm_for_upgrades: CanisterWasm,
    #[serde(default)]
    pub community_canister_wasm_for_new_canisters: CanisterWasm,
    #[serde(default)]
    pub community_canister_wasm_for_upgrades: CanisterWasm,
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    #[serde(alias = "canisters_requiring_upgrade")]
    pub groups_requiring_upgrade: CanistersRequiringUpgrade,
    #[serde(default)]
    pub communities_requiring_upgrade: CanistersRequiringUpgrade,
    pub cycles_dispenser_canister_id: CanisterId,
    pub proposals_bot_user_id: UserId,
    pub canister_pool: canister::Pool,
    pub total_cycles_spent_on_canisters: Cycles,
    pub test_mode: bool,
    #[serde(alias = "max_concurrent_canister_upgrades")]
    pub max_concurrent_group_upgrades: u32,
    pub group_upgrade_concurrency: u32,
    #[serde(default = "ten")]
    pub max_concurrent_community_upgrades: u32,
    #[serde(default = "two")]
    pub community_upgrade_concurrency: u32,
}

fn ten() -> u32 {
    10
}

fn two() -> u32 {
    2
}

impl Data {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        group_canister_wasm: CanisterWasm,
        community_canister_wasm: CanisterWasm,
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
            local_communities: LocalCommunityMap::default(),
            group_canister_wasm_for_new_canisters: group_canister_wasm.clone(),
            group_canister_wasm_for_upgrades: group_canister_wasm,
            community_canister_wasm_for_new_canisters: community_canister_wasm.clone(),
            community_canister_wasm_for_upgrades: community_canister_wasm,
            user_index_canister_id,
            local_user_index_canister_id,
            group_index_canister_id,
            notifications_canister_id,
            cycles_dispenser_canister_id,
            proposals_bot_user_id,
            groups_requiring_upgrade: CanistersRequiringUpgrade::default(),
            communities_requiring_upgrade: CanistersRequiringUpgrade::default(),
            canister_pool: canister::Pool::new(canister_pool_target_size),
            total_cycles_spent_on_canisters: 0,
            test_mode,
            max_concurrent_group_upgrades: 10,
            group_upgrade_concurrency: 10,
            max_concurrent_community_upgrades: 10,
            community_upgrade_concurrency: 2,
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
    pub local_community_count: u64,
    pub canisters_in_pool: u16,
    pub group_upgrades_completed: u64,
    pub group_upgrades_failed: Vec<FailedUpgradeCount>,
    pub group_upgrades_pending: u64,
    pub group_upgrades_in_progress: u64,
    pub community_upgrades_completed: u64,
    pub community_upgrades_failed: Vec<FailedUpgradeCount>,
    pub community_upgrades_pending: u64,
    pub community_upgrades_in_progress: u64,
    pub group_wasm_version: Version,
    pub community_wasm_version: Version,
    pub max_concurrent_group_upgrades: u32,
    pub group_upgrade_concurrency: u32,
    pub max_concurrent_community_upgrades: u32,
    pub community_upgrade_concurrency: u32,
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
