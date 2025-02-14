use crate::model::challenges::Challenges;
use crate::model::identity_link_requests::IdentityLinkRequests;
use crate::model::salt::Salt;
use crate::model::user_principals::UserPrincipals;
use crate::model::webauthn_keys::WebAuthnKeys;
use candid::Principal;
use canister_state_macros::canister_state;
use ic_canister_sig_creation::signature_map::{SignatureMap, LABEL_SIG};
use ic_canister_sig_creation::CanisterSigPublicKey;
use ic_cdk::api::set_certified_data;
use identity_canister::{WebAuthnKey, WEBAUTHN_ORIGINATING_CANISTER};
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use sha256::sha256;
use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap, HashSet};
use types::{BuildVersion, CanisterId, Cycles, TimestampMillis, Timestamped};
use utils::env::Environment;
use x509_parser::prelude::{FromDer, SubjectPublicKeyInfo};

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
        webauthn_credential_id: Option<ByteBuf>,
        is_ii_principal: bool,
    ) -> [u8; 32] {
        let index = self.data.user_principals.next_index();
        let seed = self.data.calculate_seed(index);
        let public_key = self.der_encode_canister_sig_key(seed);
        let principal = Principal::self_authenticating(public_key);

        self.data.user_principals.push(
            index,
            principal,
            auth_principal,
            originating_canister,
            webauthn_credential_id,
            is_ii_principal,
            self.env.now(),
        );

        seed
    }

    pub fn verify_new_identity(&self, args: VerifyNewIdentityArgs) -> Result<VerifyNewIdentitySuccess, VerifyNewIdentityError> {
        use VerifyNewIdentityError::*;

        let caller = self.env.caller();

        if self.data.user_principals.auth_principal_exists(&caller) {
            return Err(AlreadyRegistered);
        }

        if let Err(error) = check_public_key(caller, &args.public_key) {
            return Err(PublicKeyInvalid(error));
        }

        let (auth_principal, originating_canister) = if let Some(webauthn_key) = args.webauthn_key.as_ref() {
            self.assert_key_not_generated_by_this_canister(&webauthn_key.public_key);

            (
                Principal::self_authenticating(&webauthn_key.public_key),
                WEBAUTHN_ORIGINATING_CANISTER,
            )
        } else {
            match extract_originating_canister(&args.public_key) {
                Ok(canister_id) => (caller, canister_id),
                Err(error) => return Err(PublicKeyInvalid(error)),
            }
        };

        if !self.data.originating_canisters.contains(&originating_canister) {
            return Err(OriginatingCanisterInvalid(originating_canister));
        }

        if self.data.user_principals.auth_principal_exists(&auth_principal) {
            return Err(AlreadyRegistered);
        }

        Ok(VerifyNewIdentitySuccess {
            caller,
            auth_principal,
            originating_canister,
            webauthn_key: args.webauthn_key,
        })
    }

    // All OC user keys are generated by this canister, so this function ensures that the key
    // is not an OC user key.
    pub fn assert_key_not_generated_by_this_canister(&self, public_key: &[u8]) {
        if let Ok(originating_canister) = extract_originating_canister(public_key) {
            assert_ne!(originating_canister, self.env.canister_id());
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
    #[serde(default)]
    webauthn_keys: WebAuthnKeys,
    #[serde(skip)]
    signature_map: SignatureMap,
    #[serde(with = "serde_bytes")]
    ic_root_key: Vec<u8>,
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
            webauthn_keys: WebAuthnKeys::default(),
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

fn check_public_key(caller: Principal, public_key: &[u8]) -> Result<(), String> {
    let expected_caller = Principal::self_authenticating(public_key);
    if caller == expected_caller {
        Ok(())
    } else {
        Err("PublicKey does not match caller".to_string())
    }
}

fn extract_originating_canister(public_key: &[u8]) -> Result<CanisterId, String> {
    let key_info = SubjectPublicKeyInfo::from_der(public_key).map_err(|e| format!("{e:?}"))?.1;
    if key_info.subject_public_key.data.is_empty() {
        return Err("subject_public_key.data is empty".to_string());
    }

    let canister_id_length = key_info.subject_public_key.data[0] as usize;
    if canister_id_length >= key_info.subject_public_key.data.len() || canister_id_length > CanisterId::MAX_LENGTH_IN_BYTES {
        return Err("subject_public_key.data does not contain a canisterId".to_string());
    }

    let canister_id = CanisterId::from_slice(&key_info.subject_public_key.data[1..=canister_id_length]);
    Ok(canister_id)
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

struct VerifyNewIdentityArgs {
    public_key: Vec<u8>,
    webauthn_key: Option<WebAuthnKey>,
}

struct VerifyNewIdentitySuccess {
    caller: Principal,
    auth_principal: Principal,
    originating_canister: CanisterId,
    webauthn_key: Option<WebAuthnKey>,
}

enum VerifyNewIdentityError {
    AlreadyRegistered,
    PublicKeyInvalid(String),
    OriginatingCanisterInvalid(CanisterId),
}
