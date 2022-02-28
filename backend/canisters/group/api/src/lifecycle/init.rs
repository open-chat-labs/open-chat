use candid::{CandidType, Principal};
use serde::Deserialize;
use types::{Avatar, CanisterId, Milliseconds, UserId, Version};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub avatar: Option<Avatar>,
    pub history_visible_to_new_joiners: bool,
    pub created_by_principal: Principal,
    pub created_by_user_id: UserId,
    pub mark_active_duration: Milliseconds,
    pub user_index_canister_id: CanisterId,
    pub notifications_canister_ids: Vec<CanisterId>,
    pub callback_canister_id: CanisterId,
    pub wasm_version: Version,
    pub test_mode: bool,
}
