use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub users: Vec<UserConfig>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UserConfig {
    // Note this is called user_id from the OpenStorage perspective but is actually
    // the OpenChat user principal and *not* the OpenChat user_id (CanisterId)
    pub user_id: Principal,
    pub byte_limit: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
