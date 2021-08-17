use candid::CandidType;
use serde::Deserialize;
use types::{PartialUserSummary, TimestampMillis, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub users: Vec<UserId>,
    pub updated_since: Option<TimestampMillis>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct Result {
    pub users: Vec<PartialUserSummary>,
    pub timestamp: TimestampMillis,
}
