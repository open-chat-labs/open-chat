use canister_state_macros::canister_state;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::BTreeMap;
use types::{BuildVersion, CanisterId, Cycles, TimestampMillis, Timestamped};
use utils::env::Environment;

mod lifecycle;
mod memory;
mod queries;
mod updates;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
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
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            liquid_cycles_balance: self.env.liquid_cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: git_commit_id::git_commit_id().to_string(),
            stable_memory_sizes: memory::memory_sizes(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                local_user_index: self.data.local_user_index_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        user_index_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        rng_seed: [u8; 32],
        test_mode: bool,
    ) -> Data {
        Data {
            user_index_canister_id,
            local_user_index_canister_id,
            rng_seed,
            test_mode,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub cycles_balance: Cycles,
    pub liquid_cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub local_user_index: CanisterId,
}
