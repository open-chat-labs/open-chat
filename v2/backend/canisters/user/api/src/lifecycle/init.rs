use candid::{CandidType, Principal};
use serde::Deserialize;
use types::{CanisterId, Version};

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub owner: Principal,
    pub group_index_canister_id: CanisterId,
    pub notification_canister_ids: Vec<CanisterId>,
    pub wasm_version: Version,
}
