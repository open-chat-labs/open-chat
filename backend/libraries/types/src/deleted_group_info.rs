use crate::{
    local_user_index_canister_id, CanisterId, ChannelLatestMessageIndex, ChatId, CommunityId, TimestampMillis, UserId,
};
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
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct DeletedGroupInfoInternal {
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
#[serde(from = "CommunityImportedIntoPrevious")]
pub struct CommunityImportedInto {
    pub community_name: String,
    pub community_id: CommunityId,
    pub local_user_index_canister_id: CanisterId,
    pub channel: ChannelLatestMessageIndex,
    pub other_default_channels: Vec<ChannelLatestMessageIndex>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct CommunityImportedIntoPrevious {
    pub community_name: String,
    pub community_id: CommunityId,
    pub channel: ChannelLatestMessageIndex,
    pub other_default_channels: Vec<ChannelLatestMessageIndex>,
}

impl From<CommunityImportedIntoPrevious> for CommunityImportedInto {
    fn from(value: CommunityImportedIntoPrevious) -> Self {
        CommunityImportedInto {
            community_name: value.community_name,
            community_id: value.community_id,
            local_user_index_canister_id: local_user_index_canister_id(value.community_id.into()),
            channel: value.channel,
            other_default_channels: value.other_default_channels,
        }
    }
}

impl From<DeletedGroupInfoInternal> for DeletedGroupInfo {
    fn from(value: DeletedGroupInfoInternal) -> Self {
        DeletedGroupInfo {
            id: value.id,
            timestamp: value.timestamp,
            deleted_by: value.deleted_by,
            group_name: value.group_name,
            name: value.name,
            public: value.public,
        }
    }
}
