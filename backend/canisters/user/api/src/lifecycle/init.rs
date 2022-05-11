use candid::{CandidType, Principal};
use serde::Deserialize;
use types::{CanisterId, Version};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub owner: Principal,
    pub group_index_canister_id: CanisterId,
    pub notifications_canister_ids: Vec<CanisterId>,
    pub callback_canister_id: CanisterId,
    pub ledger_canister_id: CanisterId,
    pub wasm_version: Version,
    pub test_mode: bool,
}
