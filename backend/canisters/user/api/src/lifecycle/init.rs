use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId, MessageContent};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub owner: Principal,
    pub group_index_canister_id: CanisterId,
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub wasm_version: BuildVersion,
    pub username: String,
    #[serde(default)]
    pub display_name: Option<String>,
    pub openchat_bot_messages: Vec<MessageContent>,
    pub test_mode: bool,
}
