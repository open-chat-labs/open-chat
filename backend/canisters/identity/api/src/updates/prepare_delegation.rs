use crate::Delegation;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub session_key: ByteBuf,
    pub max_time_to_live: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Delegation),
    NotFound,
}
