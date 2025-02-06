use crate::model::challenges::Challenges;
use crate::model::identity_link_requests::IdentityLinkRequests;
use crate::model::salt::Salt;
use crate::model::user_principals::UserPrincipals;
use crate::model::webauthn_keys::WebAuthnKeys;
use candid::Principal;
use canister_state_macros::canister_state;
use constants::{DAY_IN_MS, NANOS_PER_MILLISECOND};
use ic_canister_sig_creation::signature_map::{CanisterSigInputs, SignatureMap, LABEL_SIG};
use ic_canister_sig_creation::{delegation_signature_msg, CanisterSigPublicKey, DELEGATION_SIG_DOMAIN};
use ic_cdk::api::set_certified_data;
use identity_canister::prepare_delegation::SuccessResult;
use serde::{Deserialize, Serialize};
use sha256::sha256;
use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap, HashSet};
use types::{
    BuildVersion, CanisterId, Cycles, Delegation, Nanoseconds, SignedDelegation, TimestampMillis, TimestampNanos, Timestamped,
};
use utils::env::Environment;
use x509_parser::prelude::{FromDer, SubjectPublicKeyInfo};

mod guards;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

const DEFAULT_DELEGATION_EXPIRATION_PERIOD: Nanoseconds = 30 * DAY_IN_MS * NANOS_PER_MILLISECOND;
const MAX_DELEGATION_EXPIRATION_PERIOD: Nanoseconds = 90 * DAY_IN_MS * NANOS_PER_MILLISECOND;

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

    pub fn prepare_delegation(
        &mut self,
        seed: [u8; 32],
        session_key: Vec<u8>,
        max_time_to_live: Option<Nanoseconds>,
    ) -> SuccessResult {
        let delta = Nanoseconds::min(
            max_time_to_live.unwrap_or(DEFAULT_DELEGATION_EXPIRATION_PERIOD),
            MAX_DELEGATION_EXPIRATION_PERIOD,
        );
        let expiration = self.env.now_nanos().saturating_add(delta);

        self.data.signature_map.add_signature(&CanisterSigInputs {
            domain: DELEGATION_SIG_DOMAIN,
            seed: &seed,
            message: &delegation_signature_msg(&session_key, expiration, None),
        });
        self.data.update_root_hash();

        SuccessResult {
            user_key: self.der_encode_canister_sig_key(seed),
            expiration,
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
            user_principals: self.data.user_principals.user_principals_count(),
            auth_principals: self.data.user_principals.auth_principals_count(),
            originating_canisters: self.data.user_principals.originating_canisters().clone(),
            stable_memory_sizes: memory::memory_sizes(),
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
    originating_canisters: HashSet<CanisterId>,
    skip_captcha_whitelist: HashSet<CanisterId>,
    user_principals: UserPrincipals,
    identity_link_requests: IdentityLinkRequests,
    #[serde(skip)]
    signature_map: SignatureMap,
    #[serde(with = "serde_bytes")]
    ic_root_key: Vec<u8>,
    #[serde(default)]
    webauthn_keys: WebAuthnKeys,
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
            webauthn_keys: WebAuthnKeys::default(),
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

    pub fn calculate_webauthn_seed(&self, credential_id: &[u8]) -> [u8; 32] {
        let salt = self.salt.get();

        let mut bytes: Vec<u8> = vec![];
        bytes.push(salt.len() as u8);
        bytes.extend_from_slice(&salt);
        bytes.extend_from_slice(credential_id);

        sha256(&bytes)
    }

    pub fn update_root_hash(&mut self) {
        let prefixed_root_hash = ic_certification::labeled_hash(LABEL_SIG, &self.signature_map.root_hash());
        set_certified_data(&prefixed_root_hash[..]);
    }

    pub fn requires_captcha(&self, originating_canister_id: &CanisterId) -> bool {
        !self.skip_captcha_whitelist.contains(originating_canister_id)
    }

    pub fn get_delegation(&self, session_key: Vec<u8>, expiration: TimestampNanos, seed: [u8; 32]) -> Option<SignedDelegation> {
        let signature = self
            .signature_map
            .get_signature_as_cbor(
                &CanisterSigInputs {
                    domain: DELEGATION_SIG_DOMAIN,
                    seed: &seed,
                    message: &delegation_signature_msg(&session_key, expiration, None),
                },
                None,
            )
            .ok()?;

        let delegation = Delegation {
            pubkey: session_key,
            expiration,
        };

        Some(SignedDelegation { delegation, signature })
    }
}

fn extract_originating_canister(caller: Principal, public_key: &[u8]) -> Result<CanisterId, String> {
    check_public_key(caller, public_key)?;

    let key_info = SubjectPublicKeyInfo::from_der(public_key).map_err(|e| format!("{e:?}"))?.1;
    let canister_id_length = key_info.subject_public_key.data[0];

    let canister_id = CanisterId::from_slice(&key_info.subject_public_key.data[1..=(canister_id_length as usize)]);
    Ok(canister_id)
}

fn check_public_key(caller: Principal, public_key: &[u8]) -> Result<(), String> {
    let expected_caller = Principal::self_authenticating(public_key);
    if caller == expected_caller {
        Ok(())
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
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
}
