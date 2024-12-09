use crate::ecdsa::{get_key_id, CanisterEcdsaRequest};
use candid::{CandidType, Principal};
use canister_state_macros::canister_state;
use constants::{MINUTE_IN_MS, NANOS_PER_MILLISECOND};
use ic_transport_types::EnvelopeContent;
use k256::pkcs8::EncodePublicKey;
use k256::PublicKey;
use nns_governance_canister::types::Neuron;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::BTreeMap;
use types::{BuildVersion, CanisterId, Cycles, TimestampMillis, Timestamped};
use utils::env::Environment;

mod ecdsa;
mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod queries;
mod updates;

const IC_URL: &str = "https://icp-api.io";

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

    pub fn prepare_canister_call_via_ecdsa<A: CandidType>(
        &mut self,
        canister_id: CanisterId,
        method_name: String,
        args: A,
    ) -> CanisterEcdsaRequest {
        let nonce: [u8; 8] = self.env.rng().gen();

        let envelope_content = EnvelopeContent::Call {
            nonce: Some(nonce.to_vec()),
            ingress_expiry: self.env.now_nanos() + 5 * MINUTE_IN_MS * NANOS_PER_MILLISECOND,
            sender: self.data.get_principal(),
            canister_id,
            method_name,
            arg: candid::encode_one(&args).unwrap(),
        };

        CanisterEcdsaRequest {
            envelope_content,
            request_url: format!("{IC_URL}/api/v2/canister/{canister_id}/call"),
            public_key: self.data.get_public_key_der(),
            key_id: get_key_id(false),
            this_canister_id: self.env.canister_id(),
        }
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            public_key: hex::encode(&self.data.public_key),
            public_key_der: hex::encode(self.data.get_public_key_der()),
            principal: self.data.get_principal(),
            governance_principals: self.data.governance_principals.clone(),
            active_neurons: self
                .data
                .neurons
                .active_neurons
                .iter()
                .filter_map(|n| n.id.as_ref().map(|i| i.id))
                .collect(),
            spawning_neurons: self
                .data
                .neurons
                .spawning_neurons
                .iter()
                .filter_map(|n| n.id.as_ref().map(|i| i.id))
                .collect(),
            disbursed_neurons: self.data.neurons.disbursed_neurons.clone(),
            stable_memory_sizes: memory::memory_sizes(),
            canister_ids: CanisterIds {
                nns_governance_canister: self.data.nns_governance_canister_id,
                nns_ledger_canister: self.data.nns_ledger_canister_id,
                cycles_minting_canister: self.data.cycles_minting_canister_id,
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
    pub cycles_minting_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub neurons: Neurons,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        governance_principals: Vec<Principal>,
        nns_governance_canister_id: CanisterId,
        nns_ledger_canister_id: CanisterId,
        cycles_minting_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            public_key: Vec::new(),
            governance_principals,
            nns_governance_canister_id,
            nns_ledger_canister_id,
            cycles_minting_canister_id,
            cycles_dispenser_canister_id,
            neurons: Neurons::default(),
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
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub public_key: String,
    pub public_key_der: String,
    pub principal: Principal,
    pub governance_principals: Vec<Principal>,
    pub active_neurons: Vec<u64>,
    pub spawning_neurons: Vec<u64>,
    pub disbursed_neurons: Vec<u64>,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub nns_governance_canister: CanisterId,
    pub nns_ledger_canister: CanisterId,
    pub cycles_minting_canister: CanisterId,
    pub cycles_dispenser: CanisterId,
}

#[derive(Serialize, Deserialize, Default)]
pub struct Neurons {
    timestamp: TimestampMillis,
    active_neurons: Vec<Neuron>,
    spawning_neurons: Vec<Neuron>,
    disbursed_neurons: Vec<u64>,
}
