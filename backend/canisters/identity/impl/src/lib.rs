use crate::model::challenges::Challenges;
use crate::model::salt::Salt;
use crate::model::user_principals::UserPrincipals;
use candid::Principal;
use canister_sig_util::signature_map::{SignatureMap, LABEL_SIG};
use canister_sig_util::CanisterSigPublicKey;
use canister_state_macros::canister_state;
use ic_cdk::api::set_certified_data;
use identity_canister::Delegation;
use serde::{Deserialize, Serialize};
use sha256::sha256;
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use types::{BuildVersion, CanisterId, Cycles, Hash, TimestampMillis, Timestamped};
use utils::env::Environment;

mod hash;
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

    pub fn get_principal_from_seed(&self, seed: [u8; 32]) -> Principal {
        let public_key = self.der_encode_canister_sig_key(seed);
        Principal::self_authenticating(public_key)
    }

    pub fn der_encode_canister_sig_key(&self, seed: [u8; 32]) -> Vec<u8> {
        let canister_id = self.env.canister_id();
        CanisterSigPublicKey::new(canister_id, seed.to_vec()).to_der()
    }

    pub fn push_new_user(&mut self, auth_principal: Principal, originating_canister: CanisterId) -> (Principal, [u8; 32]) {
        let index = self.data.user_principals.next_index();
        let seed = self.data.calculate_seed(index);
        let principal = self.get_principal_from_seed(seed);
        self.data
            .user_principals
            .push(index, principal, auth_principal, originating_canister);

        (principal, seed)
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            user_principals: self.data.user_principals.user_principals_count(),
            auth_principals: self.data.user_principals.auth_principals_count(),
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
    #[serde(default)]
    skip_captcha_whitelist: HashSet<CanisterId>,
    user_principals: UserPrincipals,
    #[serde(skip)]
    signature_map: SignatureMap,
    salt: Salt,
    rng_seed: [u8; 32],
    challenges: Challenges,
    test_mode: bool,
}

impl Data {
    pub fn new(
        governance_principals: HashSet<Principal>,
        user_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        skip_captcha_whitelist: Vec<CanisterId>,
        test_mode: bool,
    ) -> Data {
        Data {
            governance_principals,
            user_index_canister_id,
            cycles_dispenser_canister_id,
            skip_captcha_whitelist: skip_captcha_whitelist.into_iter().collect(),
            user_principals: UserPrincipals::default(),
            signature_map: SignatureMap::default(),
            salt: Salt::default(),
            rng_seed: [0; 32],
            challenges: Challenges::default(),
            test_mode,
        }
    }

    pub fn calculate_seed(&self, index: u32) -> [u8; 32] {
        let salt = self.salt.get();

        let mut bytes: Vec<u8> = vec![];
        bytes.push(salt.len() as u8);
        bytes.extend_from_slice(&salt);

        let index_str = index.to_string();
        let index_bytes = index_str.bytes();
        bytes.push(index_bytes.len() as u8);
        bytes.extend(index_bytes);

        sha256(&bytes)
    }

    pub fn update_root_hash(&mut self) {
        let prefixed_root_hash = ic_certification::labeled_hash(LABEL_SIG, &self.signature_map.root_hash());
        set_certified_data(&prefixed_root_hash[..]);
    }

    pub fn requires_captcha(&self, originating_canister_id: &CanisterId) -> bool {
        !self.skip_captcha_whitelist.contains(originating_canister_id)
    }
}

fn delegation_signature_msg_hash(d: &Delegation) -> Hash {
    use hash::Value;
    let mut m = HashMap::new();
    m.insert("pubkey", Value::Bytes(d.pubkey.as_slice()));
    m.insert("expiration", Value::U64(d.expiration));
    let map_hash = hash::hash_of_map(m);
    hash::hash_with_domain(b"ic-request-auth-delegation", &map_hash)
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub user_principals: u32,
    pub auth_principals: u32,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
}
