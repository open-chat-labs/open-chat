use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Nanoseconds, TimestampNanos};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    #[serde(with = "serde_bytes")]
    pub session_key: Vec<u8>,
    pub is_ii_principal: Option<bool>,
    pub max_time_to_live: Option<Nanoseconds>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotFound,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    #[serde(with = "serde_bytes")]
    pub user_key: Vec<u8>,
    pub expiration: TimestampNanos,
}
