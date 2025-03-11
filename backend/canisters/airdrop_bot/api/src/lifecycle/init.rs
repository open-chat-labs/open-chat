use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub online_users_canister_id: CanisterId,
    pub chat_ledger_canister_id: CanisterId,
    pub admins: Vec<Principal>,
    pub wasm_version: BuildVersion,
    pub test_mode: bool,
}
