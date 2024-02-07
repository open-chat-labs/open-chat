use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub locale: String,
    pub key: String,
    pub value: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(u64),
    AlreadyProposed,
    UserNotFound,
    InvalidArgs(String),
    InternalError(String),
}
