use candid::CandidType;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use types::{Nanoseconds, TimestampNanos};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub session_key: ByteBuf,
    pub max_time_to_live: Option<Nanoseconds>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotFound,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub user_key: ByteBuf,
    pub expiration: TimestampNanos,
}
