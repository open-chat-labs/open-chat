use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub id: u64,
    pub reason: RejectReason,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotProposed,
    NotFound,
    NotAuthorized,
    InternalError(String),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum RejectReason {
    TooLong,
    IncorrectMeaning,
}
