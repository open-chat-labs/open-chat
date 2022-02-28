use candid::{CandidType, Principal};
use serde::Deserialize;
use types::{CanisterId, CanisterWasm, Version};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    // Only these principals can call upgrade_group_canister_wasm
    pub service_principals: Vec<Principal>,

    pub group_canister_wasm: CanisterWasm,
    pub notifications_canister_ids: Vec<CanisterId>,
    pub user_index_canister_id: CanisterId,
    pub callback_canister_id: CanisterId,
    pub wasm_version: Version,
    pub test_mode: bool,
}
