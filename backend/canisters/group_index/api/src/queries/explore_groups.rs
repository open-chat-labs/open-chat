use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::GroupMatch;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, explore_groups)]
pub struct Args {
    pub search_term: Option<String>,
    pub page_index: u32,
    pub page_size: u8,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, explore_groups)]
pub enum Response {
    Success(SuccessResult),
    TermTooShort(u8),
    TermTooLong(u8),
    InvalidTerm,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, explore_groups)]
pub struct SuccessResult {
    pub matches: Vec<GroupMatch>,
    pub total: u32,
}
