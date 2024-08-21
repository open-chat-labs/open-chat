use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::{TimestampMillis, UserSummary};

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, search)]
pub struct Args {
    pub search_term: String,
    pub max_results: u8,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, search)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, search)]
pub struct Result {
    pub users: Vec<UserSummary>,
    pub timestamp: TimestampMillis,
}
