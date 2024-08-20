use candid::CandidType;
use ts_export::ts_export;
use types::{ChatId, PublicGroupSummary};

#[ts_export(group_index, recommended_groups)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub count: u8,
    pub exclusions: Vec<ChatId>,
}

#[ts_export(group_index, recommended_groups)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(group_index, recommended_groups)]
#[derive(CandidType, Debug)]
pub struct SuccessResult {
    pub groups: Vec<PublicGroupSummary>,
}
