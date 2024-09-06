use crate::model::challenges::Challenges;
use crate::model::identity_link_requests::IdentityLinkRequests;
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
use utils::consts::IC_ROOT_KEY;
use utils::env::Environment;
use x509_parser::prelude::{FromDer, SubjectPublicKeyInfo};

mod guards;
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

    pub fn is_caller_user_index_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.user_index_canister_id == caller
    }

    pub fn der_encode_canister_sig_key(&self, seed: [u8; 32]) -> Vec<u8> {
        let canister_id = self.env.canister_id();
        CanisterSigPublicKey::new(canister_id, seed.to_vec()).to_der()
    }

    pub fn push_new_user(
        &mut self,
        auth_principal: Principal,
        originating_canister: CanisterId,
        is_ii_principal: bool,
    ) -> [u8; 32] {
        let index = self.data.user_principals.next_index();
        let seed = self.data.calculate_seed(index);
        let public_key = self.der_encode_canister_sig_key(seed);
        let principal = Principal::self_authenticating(public_key);

        self.data
            .user_principals
            .push(index, principal, auth_principal, originating_canister, is_ii_principal);

        seed
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
            originating_canisters: self.data.user_principals.originating_canisters().clone(),
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
    originating_canisters: HashSet<CanisterId>,
    skip_captcha_whitelist: HashSet<CanisterId>,
    user_principals: UserPrincipals,
    #[serde(default)]
    identity_link_requests: IdentityLinkRequests,
    #[serde(skip)]
    signature_map: SignatureMap,
    #[serde(with = "serde_bytes", default = "ic_root_key")]
    ic_root_key: Vec<u8>,
    salt: Salt,
    rng_seed: [u8; 32],
    challenges: Challenges,
    test_mode: bool,
}

fn ic_root_key() -> Vec<u8> {
    IC_ROOT_KEY.to_vec()
}

impl Data {
    pub fn new(
        governance_principals: HashSet<Principal>,
        user_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        originating_canisters: Vec<CanisterId>,
        skip_captcha_whitelist: Vec<CanisterId>,
        ic_root_key: Vec<u8>,
        test_mode: bool,
    ) -> Data {
        Data {
            governance_principals,
            user_index_canister_id,
            cycles_dispenser_canister_id,
            originating_canisters: originating_canisters.into_iter().collect(),
            skip_captcha_whitelist: skip_captcha_whitelist.into_iter().collect(),
            user_principals: UserPrincipals::default(),
            identity_link_requests: IdentityLinkRequests::default(),
            signature_map: SignatureMap::default(),
            ic_root_key,
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

fn extract_originating_canister(caller: Principal, public_key: &[u8]) -> Result<CanisterId, String> {
    let key_info = SubjectPublicKeyInfo::from_der(public_key).map_err(|e| format!("{e:?}"))?.1;
    let canister_id_length = key_info.subject_public_key.data[0];

    let canister_id = CanisterId::from_slice(&key_info.subject_public_key.data[1..=(canister_id_length as usize)]);

    let expected_caller = Principal::self_authenticating(public_key);
    if caller == expected_caller {
        Ok(canister_id)
    } else {
        Err("PublicKey does not match caller".to_string())
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
    pub user_principals: u32,
    pub auth_principals: u32,
    pub originating_canisters: HashMap<CanisterId, u32>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
}
