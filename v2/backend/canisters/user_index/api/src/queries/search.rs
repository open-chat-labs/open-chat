use candid::CandidType;
use serde::Deserialize;
use types::UserSummary;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub search_term: String,
    pub max_results: u8,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct Result {
    pub users: Vec<UserSummary>,
}
