use candid::{CandidType, Deserialize, Principal};
use serde::Serialize;
use serde_bytes::ByteBuf;
use types::{Nanoseconds, TimestampNanos};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub public_key: ByteBuf,
    pub session_key: ByteBuf,
    pub max_time_to_live: Option<Nanoseconds>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    AlreadyRegistered,
    PublicKeyInvalid(String),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub principal: Principal,
    pub user_key: ByteBuf,
    pub expiration: TimestampNanos,
}
