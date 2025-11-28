use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_principals: Vec<Principal>,
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub sign_in_with_email_canister_id: CanisterId,
    pub originating_canisters: Vec<CanisterId>,
    pub skip_captcha_whitelist: Vec<CanisterId>,
    #[serde(with = "serde_bytes")]
    pub oc_secret_key_der: Vec<u8>,
    pub rng_seed: [u8; 32],
    pub wasm_version: BuildVersion,
    pub test_mode: bool,
}
