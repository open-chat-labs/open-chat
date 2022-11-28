use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageMatch, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub search_term: String,
    pub max_results: u8,
    pub users: Option<Vec<UserId>>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    InvalidTerm,
    TermTooLong(u8),
    TermTooShort(u8),
    TooManyUsers(u8),
    CallerNotInGroup,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub matches: Vec<MessageMatch>,
}
