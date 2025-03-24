use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    // The wasm version running on this canister
    pub wasm_version: BuildVersion,
    pub user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub identity_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub proposals_bot_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub escrow_canister_id: CanisterId,
    pub event_relay_canister_id: CanisterId,
    pub online_users_canister_id: CanisterId,
    pub internet_identity_canister_id: CanisterId,
    pub website_canister_id: CanisterId,
    pub video_call_operators: Vec<Principal>,
    pub oc_secret_key_der: Option<Vec<u8>>,
    pub ic_root_key: Vec<u8>,
    pub test_mode: bool,
}
