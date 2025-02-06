use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::TimestampNanos;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    #[serde(with = "serde_bytes")]
    pub credential_id: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub session_key: Vec<u8>,
    pub expiration: TimestampNanos,
}

pub type Response = crate::get_delegation::Response;
