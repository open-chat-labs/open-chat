use candid::Principal;
use canister_state_macros::canister_state;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use types::{BuildVersion, CanisterId, Cycles, TimestampMillis, Timestamped};
use utils::env::Environment;

mod lifecycle;
mod memory;
mod model;
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
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            push_events_whitelist: self.data.push_events_whitelist.iter().copied().collect(),
            canister_ids: CanisterIds {
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub push_events_whitelist: HashSet<Principal>,
    pub cycles_dispenser_canister_id: CanisterId,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

impl Data {
    pub fn new(push_events_whitelist: HashSet<Principal>, cycles_dispenser_canister_id: CanisterId, test_mode: bool) -> Data {
        Data {
            push_events_whitelist,
            cycles_dispenser_canister_id,
            rng_seed: [0; 32],
            test_mode,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub push_events_whitelist: Vec<Principal>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub cycles_dispenser: CanisterId,
}
