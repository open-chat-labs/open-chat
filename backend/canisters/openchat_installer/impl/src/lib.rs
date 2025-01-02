use candid::Principal;
use canister_state_macros::canister_state;
use openchat_installer_canister::CanisterType;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::BTreeMap;
use types::{BuildVersion, CanisterId, ChildCanisterWasms, Cycles, TimestampMillis, Timestamped};
use utils::env::Environment;

mod guards;
mod lifecycle;
mod memory;
mod queries;
mod updates;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
}

canister_state!(State);

struct State {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl State {
    pub fn new(env: Box<dyn Environment>, data: Data) -> State {
        State { env, data }
    }

    pub fn is_caller_governance_principal(&self) -> bool {
        let caller = self.env.caller();
        self.data.governance_principals.contains(&caller)
    }

    pub fn can_caller_upload_wasm_chunks(&self) -> bool {
        let caller = self.env.caller();
        self.data.upload_wasm_chunks_whitelist.contains(&caller)
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            stable_memory_sizes: memory::memory_sizes(),
            governance_principals: self.data.governance_principals.clone(),
            upload_wasm_chunks_whitelist: self.data.upload_wasm_chunks_whitelist.clone(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    governance_principals: Vec<Principal>,
    upload_wasm_chunks_whitelist: Vec<Principal>,
    user_index_canister_id: CanisterId,
    cycles_dispenser_canister_id: CanisterId,
    canister_wasms: ChildCanisterWasms<CanisterType>,
    rng_seed: [u8; 32],
    test_mode: bool,
}

impl Data {
    pub fn new(
        governance_principals: Vec<Principal>,
        upload_wasm_chunks_whitelist: Vec<Principal>,
        user_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            governance_principals,
            upload_wasm_chunks_whitelist,
            user_index_canister_id,
            cycles_dispenser_canister_id,
            canister_wasms: ChildCanisterWasms::default(),
            rng_seed: [0; 32],
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
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub governance_principals: Vec<Principal>,
    pub upload_wasm_chunks_whitelist: Vec<Principal>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
}
