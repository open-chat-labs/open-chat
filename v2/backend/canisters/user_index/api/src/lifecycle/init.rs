use candid::{CandidType, Principal};
use serde::Deserialize;
use types::{CanisterId, CanisterWasm};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    // Only these principals can call update_user_canister_wasm
    pub service_principals: Vec<Principal>,

    // Only these principals can call pending_sms_messages
    pub sms_service_principals: Vec<Principal>,

    // The wasm module for creating user canisters
    pub user_canister_wasm: CanisterWasm,

    pub group_index_canister_id: CanisterId,

    pub notifications_canister_id: CanisterId,

    pub online_users_agg_canister_id: CanisterId,

    // Accepts confirmation code 123456
    pub test_mode: bool,
}
