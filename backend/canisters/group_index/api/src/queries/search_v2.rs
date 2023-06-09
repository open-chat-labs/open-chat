use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CommunityMatch, GroupMatch};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub scope: Scope,
    pub search_term: String,
    pub max_results: u8,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Scope {
    All,
    Communities,
    Groups,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    TermTooShort(u8),
    TermTooLong(u8),
    InvalidTerm,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub group_matches: Vec<GroupMatch>,
    pub community_matches: Vec<CommunityMatch>,
}
