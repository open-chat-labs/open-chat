use crate::model::tokens::Tokens;
use candid::Principal;
use canister_state_macros::canister_state;
use registry_canister::TokenDetails;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use types::{CanisterId, Cycles, TimestampMillis, Timestamped, Version};
use utils::env::Environment;

mod guards;
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

    pub fn is_caller_governance_principal(&self) -> bool {
        let caller = self.env.caller();
        self.data.governance_principals.contains(&caller)
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            governance_principals: self.data.governance_principals.iter().copied().collect(),
            tokens: self.data.tokens.get_all().to_vec(),
            canister_ids: CanisterIds {
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    governance_principals: HashSet<Principal>,
    #[serde(default = "sns_wasm_canister_id")]
    sns_wasm_canister_id: CanisterId,
    cycles_dispenser_canister_id: CanisterId,
    tokens: Tokens,
    test_mode: bool,
}

fn sns_wasm_canister_id() -> CanisterId {
    CanisterId::from_text("qaa6y-5yaaa-aaaaa-aaafa-cai").unwrap()
}

impl Data {
    pub fn new(
        governance_principals: HashSet<Principal>,
        sns_wasm_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            governance_principals,
            sns_wasm_canister_id,
            cycles_dispenser_canister_id,
            tokens: Tokens::default(),
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
    pub governance_principals: Vec<Principal>,
    pub tokens: Vec<TokenDetails>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub cycles_dispenser: CanisterId,
}
