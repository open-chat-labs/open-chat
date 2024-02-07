use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Empty, TimestampMillis, UserId};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResponse),
    NotAuthorized,
    InternalError(String),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResponse {
    pub records: Vec<Record>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Record {
    pub locale: String,
    pub key: String,
    pub candidates: Vec<CandidateTranslation>,
    pub deployment_count: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct CandidateTranslation {
    pub id: u64,
    pub value: String,
    pub proposed_by: UserId,
    pub proposed_at: TimestampMillis,
}
