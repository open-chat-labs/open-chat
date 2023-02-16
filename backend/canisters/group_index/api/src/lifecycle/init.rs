use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CanisterId, CanisterWasm, UserId, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    // Only these principals can call upgrade_group_canister_wasm
    pub service_principals: Vec<Principal>,

    pub group_canister_wasm: CanisterWasm,
    pub local_group_index_canister_wasm: CanisterWasm,
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub proposals_bot_user_id: UserId,
    pub wasm_version: Version,
    pub test_mode: bool,
}
