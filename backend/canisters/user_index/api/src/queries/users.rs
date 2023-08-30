use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{PartialUserSummary, TimestampMillis};

pub type Args = crate::users_v2::Args;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Result {
    pub users: Vec<PartialUserSummary>,
    pub timestamp: TimestampMillis,
}
