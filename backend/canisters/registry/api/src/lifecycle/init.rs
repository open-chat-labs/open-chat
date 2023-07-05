use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CanisterId, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_principals: Vec<Principal>,
    pub sns_wasm_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub wasm_version: Version,
    pub test_mode: bool,
}
