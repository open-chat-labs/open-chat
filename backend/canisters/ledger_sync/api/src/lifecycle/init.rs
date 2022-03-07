use candid::CandidType;
use serde::Deserialize;
use types::{CanisterId, Version};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub ledger_canister_id: CanisterId,
    pub user_index_canister_id: CanisterId,
    pub wasm_version: Version,
    pub test_mode: bool,
}
