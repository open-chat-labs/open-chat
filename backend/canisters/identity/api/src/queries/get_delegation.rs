use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{SignedDelegation, TimestampNanos};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    #[serde(with = "serde_bytes")]
    pub session_key: Vec<u8>,
    pub expiration: TimestampNanos,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SignedDelegation),
    NotFound,
}
