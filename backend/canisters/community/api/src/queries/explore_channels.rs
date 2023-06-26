use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::ChannelMatch;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub invite_code: Option<u64>,
    pub search_term: Option<String>,
    pub page_index: u32,
    pub page_size: u8,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    TermTooShort(u8),
    TermTooLong(u8),
    InvalidTerm,
    PrivateCommunity,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub matches: Vec<ChannelMatch>,
}
