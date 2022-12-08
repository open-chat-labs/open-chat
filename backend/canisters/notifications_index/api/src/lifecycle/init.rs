use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CanisterId, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub service_principals: Vec<Principal>,
    pub notifications_canister_ids: Vec<CanisterId>,
    pub push_service_principals: Vec<Principal>,
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub wasm_version: Version,
    pub test_mode: bool,
}
