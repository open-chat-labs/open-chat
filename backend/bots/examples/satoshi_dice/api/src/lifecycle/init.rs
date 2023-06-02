use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CanisterId, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub ck_btc_ledger_canister_id: CanisterId,
    pub admins: Vec<Principal>,
    pub wasm_version: Version,
    pub test_mode: bool,
}
