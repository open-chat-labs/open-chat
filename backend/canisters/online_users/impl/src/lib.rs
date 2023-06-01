use crate::model::last_online_dates::LastOnlineDates;
use crate::model::principal_to_user_id_map::PrincipalToUserIdMap;
use canister_state_macros::canister_state;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use types::{CanisterId, Cycles, TimestampMillis, Timestamped, Version};
use utils::env::Environment;

mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

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

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            mark_as_online_count: self.data.mark_as_online_count,
            batches_sent_to_user_index: self.data.batches_sent_to_user_index,
            failed_batches: self.data.failed_batches,
            active_users: self.data.cached_active_users.clone(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub last_online_dates: LastOnlineDates,
    pub principal_to_user_id_map: PrincipalToUserIdMap,
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub mark_as_online_count: u64,
    pub batches_sent_to_user_index: u64,
    pub failed_batches: u64,
    pub cached_active_users: ActiveUsers,
    pub test_mode: bool,
}

impl Data {
    pub fn new(user_index_canister_id: CanisterId, cycles_dispenser_canister_id: CanisterId, test_mode: bool) -> Data {
        Data {
            last_online_dates: LastOnlineDates::default(),
            principal_to_user_id_map: PrincipalToUserIdMap::default(),
            user_index_canister_id,
            cycles_dispenser_canister_id,
            mark_as_online_count: 0,
            batches_sent_to_user_index: 0,
            failed_batches: 0,
            cached_active_users: ActiveUsers::default(),
            test_mode,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub git_commit_id: String,
    pub mark_as_online_count: u64,
    pub batches_sent_to_user_index: u64,
    pub failed_batches: u64,
    pub active_users: ActiveUsers,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ActiveUsers {
    timestamp: TimestampMillis,
    last_5_minutes: u32,
    last_hour: u32,
    last_day: u32,
    last_7_days: u32,
    last_30_days: u32,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
}
