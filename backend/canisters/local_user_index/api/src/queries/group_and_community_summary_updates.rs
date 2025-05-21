use crate::group_and_community_summary_updates_v2::{SummaryUpdatesArgs, SummaryUpdatesResponse};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(local_user_index, group_and_community_summary_updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub requests: Vec<SummaryUpdatesArgs>,
}

#[ts_export(local_user_index, group_and_community_summary_updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<SummaryUpdatesResponse>),
}
