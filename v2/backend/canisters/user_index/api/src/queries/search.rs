use candid::CandidType;
use serde::Deserialize;
use types::user_summary::UserSummary;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub search_term: String,
    pub max_results: u8,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType, Deserialize)]
pub struct Result {
    pub users: Vec<UserSummary>,
}
