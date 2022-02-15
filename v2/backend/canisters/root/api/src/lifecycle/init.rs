use candid::CandidType;
use serde::Deserialize;
use std::collections::HashSet;
use types::{CanisterId, Version};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub service_principals: HashSet<CanisterId>,
    pub user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub online_users_aggregator_canister_id: CanisterId,
    pub open_storage_index_canister_id: CanisterId,
    pub wasm_version: Version,
    pub test_mode: bool,
}
