use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::{ChatId, CommunityId, DeletedCommunityInfo, DeletedGroupInfo, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, active_groups)]
pub struct Args {
    pub group_ids: Vec<ChatId>,
    pub community_ids: Vec<CommunityId>,
    #[ts(optional)]
    pub active_since: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, active_groups)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, active_groups)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub active_groups: Vec<ChatId>,
    pub active_communities: Vec<CommunityId>,
    pub deleted_groups: Vec<DeletedGroupInfo>,
    pub deleted_communities: Vec<DeletedCommunityInfo>,
}
