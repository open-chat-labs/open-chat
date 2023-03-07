use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(UserRecord),
    UserNotFound,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserRecord {
    pub byte_limit: u64,
    pub bytes_used: u64,
}
