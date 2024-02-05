use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub regex: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(u64),
    NotAuthorized,
    AlreadyAdded,
    InvalidRequest(String),
    InternalError(String),
}
