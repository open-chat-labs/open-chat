use crate::model::salt::Salt;
use crate::model::user_principals::UserPrincipals;
use candid::Principal;
use canister_sig_util::CanisterSigPublicKey;
use canister_state_macros::canister_state;
use serde::{Deserialize, Serialize};
use sha256::sha256;
use std::cell::RefCell;
use std::collections::HashSet;
use types::{BuildVersion, CanisterId, Cycles, TimestampMillis, Timestamped};
use utils::env::Environment;

mod guards;
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

    pub fn is_caller_user_index_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.user_index_canister_id == caller
    }

    pub fn get_principal(&self, index: u32) -> Principal {
        let canister_id = self.env.canister_id();
        let salt = self.data.salt.get();
        let seed = calculate_seed(index, salt);
        let public_key = CanisterSigPublicKey::new(canister_id, seed.to_vec()).to_der();
        Principal::self_authenticating(public_key)
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            legacy_principals: self.data.legacy_principals.len() as u32,
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    governance_principals: HashSet<Principal>,
    user_index_canister_id: CanisterId,
    cycles_dispenser_canister_id: CanisterId,
    user_principals: UserPrincipals,
    legacy_principals: HashSet<Principal>,
    #[serde(default)]
    salt: Salt,
    rng_seed: [u8; 32],
    test_mode: bool,
}

impl Data {
    pub fn new(
        governance_principals: HashSet<Principal>,
        user_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            governance_principals,
            user_index_canister_id,
            cycles_dispenser_canister_id,
            user_principals: UserPrincipals::default(),
            legacy_principals: HashSet::default(),
            salt: Salt::default(),
            rng_seed: [0; 32],
            test_mode,
        }
    }
}

fn calculate_seed(index: u32, salt: [u8; 32]) -> [u8; 32] {
    let mut bytes: Vec<u8> = vec![];
    bytes.push(salt.len() as u8);
    bytes.extend_from_slice(&salt);

    let index_str = index.to_string();
    let index_bytes = index_str.bytes();
    bytes.push(index_bytes.len() as u8);
    bytes.extend(index_bytes);

    sha256(&bytes)
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub legacy_principals: u32,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
}
