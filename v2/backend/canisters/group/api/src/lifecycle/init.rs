use candid::{CandidType, Principal};
use serde::Deserialize;
use types::{UserId, Version};

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub is_public: bool,
    pub name: String,
    pub created_by_principal: Principal,
    pub created_by_user_id: UserId,
    pub wasm_version: Version,
}
