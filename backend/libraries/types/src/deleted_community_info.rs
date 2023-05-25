use crate::{CommunityId, TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct DeletedCommunityInfo {
    pub id: CommunityId,
    pub timestamp: TimestampMillis,
    pub deleted_by: UserId,
    pub community_name: String,
    pub public: bool,
}
