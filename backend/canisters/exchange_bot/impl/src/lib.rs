use candid::Principal;
use canister_state_macros::canister_state;
use icpswap_client::ICPSwapClient;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use types::{BuildVersion, CanisterId, Cryptocurrency, Cycles, TimestampMillis, Timestamped, TokenInfo};
use utils::env::Environment;

mod guards;
mod jobs;
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

    pub fn get_icpswap_client(&self) -> ICPSwapClient {
        ICPSwapClient::new(
            self.env.canister_id(),
            CanisterId::from_text("ne2vj-6yaaa-aaaag-qb3ia-cai").unwrap(),
            TokenInfo {
                token: Cryptocurrency::InternetComputer,
                ledger: Cryptocurrency::InternetComputer.ledger_canister_id().unwrap(),
                decimals: 8,
            },
            TokenInfo {
                token: Cryptocurrency::CHAT,
                ledger: Cryptocurrency::CHAT.ledger_canister_id().unwrap(),
                decimals: 8,
            },
        )
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
            canister_ids: CanisterIds {
                local_user_index: self.data.local_user_index_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub governance_principals: HashSet<Principal>,
    pub local_user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        governance_principals: HashSet<Principal>,
        local_user_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            governance_principals,
            local_user_index_canister_id,
            cycles_dispenser_canister_id,
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
    pub governance_principals: Vec<Principal>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub local_user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
}
