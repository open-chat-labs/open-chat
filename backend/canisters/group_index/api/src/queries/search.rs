use candid::CandidType;
use serde::Deserialize;
use types::GroupMatch;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub search_term: String,
    pub max_results: u8,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    TermTooShort(u8),
    TermTooLong(u8),
    InvalidTerm,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub matches: Vec<GroupMatch>,
}
