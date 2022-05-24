use candid::CandidType;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use types::TimestampMillis;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub method_name: String,
    pub payload: ByteBuf,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
