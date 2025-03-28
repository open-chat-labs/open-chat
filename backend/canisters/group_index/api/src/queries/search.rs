use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::GroupMatch;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub search_term: String,
    pub max_results: u8,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    TermTooShort(u8),
    TermTooLong(u8),
    InvalidTerm,
    Error(OCError),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub matches: Vec<GroupMatch>,
    pub total: u32,
}
