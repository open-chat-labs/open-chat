use candid::CandidType;
use serde::Deserialize;
use types::MessageMatch;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub search_term: String,
    pub max_results: u8,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    InvalidTerm,
    TermTooLong(u8),
    TermTooShort(u8),
    CallerNotInGroup,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub matches: Vec<MessageMatch>,
}
