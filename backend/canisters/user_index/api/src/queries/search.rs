use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use types::{TimestampMillis, UserSummary};

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub struct Args {
    pub search_term: String,
    pub max_results: u8,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub struct Result {
    pub users: Vec<UserSummary>,
    pub timestamp: TimestampMillis,
}
