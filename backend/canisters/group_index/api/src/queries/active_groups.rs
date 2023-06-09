use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, CommunityId, DeletedCommunityInfo, DeletedGroupInfo, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_ids: Vec<ChatId>,
    pub community_ids: Vec<CommunityId>,
    pub active_since: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub active_groups: Vec<ChatId>,
    pub active_communities: Vec<CommunityId>,
    pub deleted_groups: Vec<DeletedGroupInfo>,
    pub deleted_communities: Vec<DeletedCommunityInfo>,
}
