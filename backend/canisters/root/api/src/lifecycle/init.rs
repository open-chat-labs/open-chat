use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CanisterId, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub service_principals: Vec<CanisterId>,
    pub user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub online_users_aggregator_canister_id: CanisterId,
    pub open_storage_index_canister_id: CanisterId,
    pub wasm_version: Version,
    pub test_mode: bool,
}
