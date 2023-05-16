use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{UserId, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub created_by_principal: Principal,
    pub created_by_user_id: UserId,
    pub wasm_version: Version,
    pub test_mode: bool,
}
