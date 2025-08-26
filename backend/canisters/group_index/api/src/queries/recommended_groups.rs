use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChatId, PublicGroupSummary};

#[ts_export(group_index, recommended_groups)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub count: u8,
    pub exclusions: Vec<ChatId>,
}

#[ts_export(group_index, recommended_groups)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(group_index, recommended_groups)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub groups: Vec<PublicGroupSummary>,
}
