use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CanisterId, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub wasm_version: Version,
    pub test_mode: bool,
}
