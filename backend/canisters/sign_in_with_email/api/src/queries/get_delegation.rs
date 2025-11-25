use crate::{SignedDelegation, TimestampNanos};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct GetDelegationArgs {
    pub email: String,
    #[serde(with = "serde_bytes")]
    pub session_key: Vec<u8>,
    pub expiration: TimestampNanos,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum GetDelegationResponse {
    Success(SignedDelegation),
    NotFound,
}
