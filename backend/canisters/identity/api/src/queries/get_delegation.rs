use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{SignedDelegation, TimestampNanos};

#[ts_export(identity, get_delegation)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    #[serde(with = "serde_bytes")]
    pub session_key: Vec<u8>,
    pub expiration: TimestampNanos,
}

#[ts_export(identity, get_delegation)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SignedDelegation),
    NotFound,
}
