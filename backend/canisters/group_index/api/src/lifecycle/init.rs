use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CanisterId, CanisterWasm, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    // Only these principals can call upgrade_group_canister_wasm
    pub service_principals: Vec<Principal>,

    pub group_canister_wasm: CanisterWasm,
    pub local_group_index_canister_wasm: CanisterWasm,
    pub notifications_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub ledger_canister_id: CanisterId,
    pub wasm_version: Version,
    pub test_mode: bool,
}
