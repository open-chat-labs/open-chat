use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub users: Vec<UserConfig>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UserConfig {
    pub user_id: Principal,
    pub byte_limit: u64,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
