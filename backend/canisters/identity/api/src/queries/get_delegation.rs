use crate::SignedDelegation;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use types::TimestampNanos;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub session_key: ByteBuf,
    pub expiration: TimestampNanos,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SignedDelegation),
    NotFound,
}
