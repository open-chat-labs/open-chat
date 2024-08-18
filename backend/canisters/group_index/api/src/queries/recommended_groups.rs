use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::{ChatId, PublicGroupSummary};

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, recommended_groups)]
pub struct Args {
    pub count: u8,
    pub exclusions: Vec<ChatId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, recommended_groups)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, recommended_groups)]
pub struct SuccessResult {
    pub groups: Vec<PublicGroupSummary>,
}
