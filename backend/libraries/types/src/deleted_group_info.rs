use crate::{ChannelId, ChatId, CommunityId, TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct DeletedGroupInfo {
    pub id: ChatId,
    pub timestamp: TimestampMillis,
    pub deleted_by: UserId,
    pub group_name: String,
    pub name: String,
    pub public: bool,
    pub community_imported_into: Option<CommunityImportedInto>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct DeletedCommunityInfo {
    pub id: CommunityId,
    pub timestamp: TimestampMillis,
    pub deleted_by: UserId,
    pub name: String,
    pub public: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct CommunityImportedInto {
    pub community_name: String,
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
}
