use candid::{CandidType, Principal};
use serde::Deserialize;

#[derive(CandidType, Deserialize)]
pub struct Args {
    // Only these principals can call update_wasm
    pub service_principals: Vec<Principal>,

    // Only these principals can call pending_sms_messages
    pub sms_service_principals: Vec<Principal>,

    // The initial wasm module for creating user canisters
    #[serde(with = "serde_bytes")]
    pub user_wasm_module: Vec<u8>,

    // Accepts confirmation code 123456
    pub test_mode: bool,
}
