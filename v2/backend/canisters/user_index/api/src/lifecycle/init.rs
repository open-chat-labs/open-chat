use candid::{CandidType, Principal};
use serde::Deserialize;
use shared::canisters::canister_wasm::CanisterWasm;
use shared::types::CanisterId;

#[derive(CandidType, Deserialize)]
pub struct Args {
    // Only these principals can call update_wasm
    pub service_principals: Vec<Principal>,

    // Only these principals can call pending_sms_messages
    pub sms_service_principals: Vec<Principal>,

    // The wasm module for creating user canisters
    pub user_canister_wasm: CanisterWasm,

    pub group_index_canister_id: CanisterId,

    pub notifications_canister_id: CanisterId,

    // Accepts confirmation code 123456
    pub test_mode: bool,
}
