use candid::{CandidType, Principal};
use serde::Deserialize;
use types::{Milliseconds, UserId, Version};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub created_by_principal: Principal,
    pub created_by_user_id: UserId,
    pub mark_active_duration: Milliseconds,
    pub wasm_version: Version,
}
