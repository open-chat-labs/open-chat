use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CanisterId, CanisterWasm, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    // Only these principals can call upgrade_user_canister_wasm
    pub service_principals: Vec<Principal>,

    // The wasm module for creating user canisters
    pub user_canister_wasm: CanisterWasm,

    // The wasm version running on this canister
    pub wasm_version: Version,

    pub user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notifications_canister_ids: Vec<CanisterId>,
    pub ledger_canister_id: CanisterId,
    pub test_mode: bool,
}
