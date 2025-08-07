use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::SuccessOnly;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub users: Vec<UserConfig>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct UserConfig {
    pub user_id: Principal,
    pub byte_limit: u64,
}

pub type Response = SuccessOnly;
