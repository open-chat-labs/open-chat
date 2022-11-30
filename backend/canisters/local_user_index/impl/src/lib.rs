use candid::Principal;
use canister_logger::LogMessagesWrapper;
use canister_state_macros::canister_state;
use model::global_user_map::GlobalUserMap;
use model::local_user_map::LocalUserMap;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use types::{CanisterId, CanisterWasm, Cycles, TimestampMillis, Timestamped, Version};
use utils::canister::{CanistersRequiringUpgrade, FailedUpgradeCount};
use utils::consts::CYCLES_REQUIRED_FOR_UPGRADE;
use utils::env::Environment;
use utils::{canister, memory};

mod guards;
mod lifecycle;
mod model;
mod queries;
mod updates;

const USER_CANISTER_INITIAL_CYCLES_BALANCE: Cycles = CYCLES_REQUIRED_FOR_UPGRADE + USER_CANISTER_TOP_UP_AMOUNT; // 0.18T cycles
const USER_CANISTER_TOP_UP_AMOUNT: Cycles = 100_000_000_000; // 0.1T cycles

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

    /// Traps if the caller is not an OpenChat user or an OpenChat user's canister
    pub fn trap_if_caller_not_open_chat_user(&self) {
        let caller = self.env.caller();

        if !self.data.global_users.is_valid_caller(caller) {
            #[cfg(not(test))]
            ic_cdk::trap("Not authorized");
        }
    }

    pub fn is_caller_notifications_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.notifications_canister_ids.contains(&caller)
    }

    pub fn is_caller_service_principal(&self) -> bool {
        let caller = self.env.caller();
        self.data.service_principals.contains(&caller)
    }

    pub fn metrics(&self) -> Metrics {
        let canister_upgrades_metrics = self.data.canisters_requiring_upgrade.metrics();
        Metrics {
            memory_used: memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            total_cycles_spent_on_canisters: self.data.total_cycles_spent_on_canisters,
            canisters_in_pool: self.data.canister_pool.len() as u16,
            local_user_count: self.data.local_users.len() as u64,
            canister_upgrades_completed: canister_upgrades_metrics.completed as u64,
            canister_upgrades_failed: canister_upgrades_metrics.failed,
            canister_upgrades_pending: canister_upgrades_metrics.pending as u64,
            canister_upgrades_in_progress: canister_upgrades_metrics.in_progress as u64,
            user_wasm_version: self.data.user_canister_wasm.version,
            max_concurrent_canister_upgrades: self.data.max_concurrent_canister_upgrades,
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub local_users: LocalUserMap,
    pub global_users: GlobalUserMap,
    pub service_principals: HashSet<Principal>,
    pub user_canister_wasm: CanisterWasm,
    pub group_index_canister_id: CanisterId,
    pub notifications_canister_ids: Vec<CanisterId>,
    pub canisters_requiring_upgrade: CanistersRequiringUpgrade,
    pub canister_pool: canister::Pool,
    pub total_cycles_spent_on_canisters: Cycles,
    pub ledger_canister_id: CanisterId,
    pub test_mode: bool,
    pub max_concurrent_canister_upgrades: usize,
}

impl Data {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        service_principals: Vec<Principal>,
        user_canister_wasm: CanisterWasm,
        group_index_canister_id: CanisterId,
        notifications_canister_ids: Vec<CanisterId>,
        ledger_canister_id: CanisterId,
        canister_pool_target_size: u16,
        test_mode: bool,
    ) -> Self {
        Data {
            local_users: LocalUserMap::default(),
            global_users: GlobalUserMap::default(),
            service_principals: service_principals.into_iter().collect(),
            user_canister_wasm,
            group_index_canister_id,
            notifications_canister_ids,
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            canister_pool: canister::Pool::new(canister_pool_target_size),
            total_cycles_spent_on_canisters: 0,
            ledger_canister_id,
            test_mode,
            max_concurrent_canister_upgrades: 2,
        }
    }
}

#[cfg(test)]
impl Default for Data {
    fn default() -> Data {
        Data {
            local_users: LocalUserMap::default(),
            global_users: GlobalUserMap::default(),
            service_principals: HashSet::new(),
            user_canister_wasm: CanisterWasm::default(),
            group_index_canister_id: Principal::anonymous(),
            notifications_canister_ids: vec![Principal::anonymous()],
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            canister_pool: canister::Pool::new(5),
            total_cycles_spent_on_canisters: 0,
            ledger_canister_id: Principal::anonymous(),
            test_mode: true,
            max_concurrent_canister_upgrades: 2,
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
    pub local_user_count: u64,
    pub canisters_in_pool: u16,
    pub canister_upgrades_completed: u64,
    pub canister_upgrades_failed: Vec<FailedUpgradeCount>,
    pub canister_upgrades_pending: u64,
    pub canister_upgrades_in_progress: u64,
    pub user_wasm_version: Version,
    pub max_concurrent_canister_upgrades: usize,
}
