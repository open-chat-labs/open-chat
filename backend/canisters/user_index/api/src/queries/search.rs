use candid::CandidType;
use ts_export::ts_export;
use types::{TimestampMillis, UserSummary};

#[ts_export(user_index, search)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub search_term: String,
    pub max_results: u8,
}

#[ts_export(user_index, search)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(Result),
}

#[ts_export(user_index, search)]
#[derive(CandidType, Debug)]
pub struct Result {
    pub users: Vec<UserSummary>,
    pub timestamp: TimestampMillis,
}
