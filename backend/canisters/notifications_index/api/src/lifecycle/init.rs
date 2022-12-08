use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CanisterId, CanisterWasm, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub service_principals: Vec<Principal>,
    pub push_service_principals: Vec<Principal>,
    pub user_index_canister_id: CanisterId,
    pub authorizers: Vec<CanisterId>,
    pub cycles_dispenser_canister_id: CanisterId,
    pub notifications_canister_wasm: CanisterWasm,
    pub wasm_version: Version,
    pub test_mode: bool,
}
