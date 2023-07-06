use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::CommunityMatch;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub search_term: Option<String>,
    pub languages: Vec<String>,
    pub page_index: u32,
    pub page_size: u8,
    pub exclude_moderation_flags: Option<u32>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    TermTooShort(u8),
    TermTooLong(u8),
    InvalidTerm,
    InvalidFlags,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub matches: Vec<CommunityMatch>,
}
