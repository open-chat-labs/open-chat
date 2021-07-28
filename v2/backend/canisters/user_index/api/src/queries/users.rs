use crate::common::user_summary::PartialUserSummary;
use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::UserId;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub users: Vec<UserId>,
    pub updated_since: Option<TimestampMillis>,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType, Deserialize)]
pub struct Result {
    pub users: Vec<PartialUserSummary>,
    pub timestamp: TimestampMillis,
}
