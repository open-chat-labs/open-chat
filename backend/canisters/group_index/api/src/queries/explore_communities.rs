use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::CommunityMatch;

#[ts_export(group_index, explore_communities)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub search_term: Option<String>,
    pub languages: Vec<String>,
    pub page_index: u32,
    pub page_size: u8,
    pub include_moderation_flags: u32,
}

#[ts_export(group_index, explore_communities)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    TermTooShort(u8),
    TermTooLong(u8),
    InvalidTerm,
    InvalidFlags,
    Error(u16, Option<String>),
}

#[ts_export(group_index, explore_communities)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub matches: Vec<CommunityMatch>,
    pub total: u32,
}
