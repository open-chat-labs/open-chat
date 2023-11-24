use candid::Principal;
use canister_state_macros::canister_state;
use k256::pkcs8::EncodePublicKey;
use k256::PublicKey;
use nns_governance_canister::types::Neuron;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use types::{BuildVersion, CanisterId, Cycles, TimestampMillis, Timestamped};
use utils::env::Environment;

mod ecdsa;
mod guards;
mod jobs;
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

    pub fn is_caller_governance_principal(&self) -> bool {
        let caller = self.env.caller();
        self.data.governance_principals.contains(&caller)
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            public_key: hex::encode(&self.data.public_key),
            public_key_der: hex::encode(self.data.get_public_key_der()),
            principal: self.data.get_principal(),
            governance_principals: self.data.governance_principals.clone(),
            neurons: self
                .data
                .neurons
                .value
                .iter()
                .filter_map(|n| n.id.as_ref().map(|i| i.id))
                .collect(),
            canister_ids: CanisterIds {
                nns_governance_canister_id: self.data.nns_governance_canister_id,
                nns_ledger_canister_id: self.data.nns_ledger_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub public_key: Vec<u8>,
    pub governance_principals: Vec<Principal>,
    pub nns_governance_canister_id: CanisterId,
    pub nns_ledger_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub neurons: Timestamped<Vec<Neuron>>,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        governance_principals: Vec<Principal>,
        nns_governance_canister_id: CanisterId,
        nns_ledger_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            public_key: Vec::new(),
            governance_principals,
            nns_governance_canister_id,
            nns_ledger_canister_id,
            cycles_dispenser_canister_id,
            neurons: Timestamped::default(),
            rng_seed: [0; 32],
            test_mode,
        }
    }

    pub fn get_public_key_der(&self) -> Vec<u8> {
        PublicKey::from_sec1_bytes(&self.public_key)
            .unwrap()
            .to_public_key_der()
            .unwrap()
            .to_vec()
    }

    pub fn get_principal(&self) -> Principal {
        Principal::self_authenticating(self.get_public_key_der())
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub public_key: String,
    pub public_key_der: String,
    pub principal: Principal,
    pub governance_principals: Vec<Principal>,
    pub neurons: Vec<u64>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub nns_governance_canister_id: CanisterId,
    pub nns_ledger_canister_id: CanisterId,
    pub cycles_dispenser: CanisterId,
}
