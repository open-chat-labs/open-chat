use candid::CandidType;
use ts_export::ts_export;
use types::GroupMatch;

#[ts_export(group_index, explore_groups)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub search_term: Option<String>,
    pub page_index: u32,
    pub page_size: u8,
}

#[ts_export(group_index, explore_groups)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(SuccessResult),
    TermTooShort(u8),
    TermTooLong(u8),
    InvalidTerm,
}

#[ts_export(group_index, explore_groups)]
#[derive(CandidType, Debug)]
pub struct SuccessResult {
    pub matches: Vec<GroupMatch>,
    pub total: u32,
}
