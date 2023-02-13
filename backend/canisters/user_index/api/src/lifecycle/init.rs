use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CanisterId, CanisterWasm, UserId, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    // Only these principals can call upgrade_user_canister_wasm
    pub service_principals: Vec<Principal>,

    pub user_canister_wasm: CanisterWasm,
    pub local_user_index_canister_wasm: CanisterWasm,
    pub group_index_canister_id: CanisterId,
    pub notifications_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub open_storage_index_canister_id: CanisterId,
    pub ledger_canister_id: CanisterId,
    pub proposals_bot_user_id: UserId,
    pub local_group_index_canister_ids: Vec<CanisterId>,
    pub wasm_version: Version,
    pub test_mode: bool,
}
