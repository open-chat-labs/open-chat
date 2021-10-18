use crate::model::canisters_requiring_upgrade::CanistersRequiringUpgrade;
use crate::model::private_groups::PrivateGroups;
use crate::model::public_groups::PublicGroups;
use candid::{CandidType, Principal};
use canister_logger::LogMessagesWrapper;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use types::{CanisterId, CanisterWasm, ChatId, Cycles, Milliseconds, TimestampMillis, Version};
use utils::canister;
use utils::env::Environment;
use utils::memory;

mod lifecycle;
mod model;
mod queries;
mod updates;

const MIN_CYCLES_BALANCE: Cycles = 5_000_000_000_000; // 5T
const GROUP_CANISTER_INITIAL_CYCLES_BALANCE: Cycles = 500_000_000_000; // 0.5T cycles
const GROUP_CANISTER_TOP_UP_AMOUNT: Cycles = 100_000_000_000; // 0.1T cycles
const MARK_ACTIVE_DURATION: Milliseconds = 10 * 60 * 1000; // 10 minutes
const STATE_VERSION: StateVersion = StateVersion::V1;

#[derive(CandidType, Deserialize)]
enum StateVersion {
    V1,
}

thread_local! {
    static RUNTIME_STATE: RefCell<Option<RuntimeState>> = RefCell::default();
    static LOG_MESSAGES: RefCell<LogMessagesWrapper> = RefCell::default();
}

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn metrics(&self) -> Metrics {
        let canister_upgrades_metrics = self.data.canisters_requiring_upgrade.metrics();
        Metrics {
            memory_used: memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            total_cycles_spent_on_canisters: self.data.total_cycles_spent_on_canisters,
            public_groups: self.data.public_groups.len() as u32,
            private_groups: self.data.private_groups.len() as u64,
            canisters_in_pool: self.data.canister_pool.len() as u16,
            canister_upgrades_pending: canister_upgrades_metrics.pending as u64,
            canister_upgrades_in_progress: canister_upgrades_metrics.in_progress as u64,
            canister_upgrades_failed: canister_upgrades_metrics.failed as u64,
            group_wasm_version: self.data.group_canister_wasm.version,
        }
    }
}

#[derive(CandidType, Deserialize)]
struct Data {
    pub public_groups: PublicGroups,
    pub private_groups: PrivateGroups,
    pub service_principals: HashSet<Principal>,
    pub group_canister_wasm: CanisterWasm,
    pub notifications_canister_id: CanisterId,
    pub canisters_requiring_upgrade: CanistersRequiringUpgrade,
    pub canister_pool: canister::Pool,
    pub test_mode: bool,
    pub total_cycles_spent_on_canisters: Cycles,
}

impl Data {
    fn new(
        service_principals: Vec<Principal>,
        group_canister_wasm: CanisterWasm,
        notifications_canister_id: CanisterId,
        canister_pool_target_size: u16,
        test_mode: bool,
    ) -> Data {
        Data {
            public_groups: PublicGroups::default(),
            private_groups: PrivateGroups::default(),
            service_principals: service_principals.into_iter().collect(),
            group_canister_wasm,
            notifications_canister_id,
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            canister_pool: canister::Pool::new(canister_pool_target_size),
            test_mode,
            total_cycles_spent_on_canisters: 0,
        }
    }

    pub fn chat_exists(&self, chat_id: &ChatId) -> bool {
        self.private_groups.get(chat_id).is_some() || self.public_groups.get(chat_id).is_some()
    }
}

#[cfg(test)]
impl Default for Data {
    fn default() -> Data {
        Data {
            public_groups: PublicGroups::default(),
            private_groups: PrivateGroups::default(),
            service_principals: HashSet::default(),
            group_canister_wasm: CanisterWasm::default(),
            notifications_canister_id: Principal::anonymous(),
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            canister_pool: canister::Pool::new(5),
            test_mode: true,
            total_cycles_spent_on_canisters: 0,
        }
    }
}

#[derive(CandidType, Serialize, Debug)]
pub struct Metrics {
    pub memory_used: u64,
    pub now: TimestampMillis,
    pub cycles_balance: Cycles,
    pub total_cycles_spent_on_canisters: Cycles,
    pub public_groups: u32,
    pub private_groups: u64,
    pub canisters_in_pool: u16,
    pub canister_upgrades_pending: u64,
    pub canister_upgrades_in_progress: u64,
    pub canister_upgrades_failed: u64,
    pub group_wasm_version: Version,
}
