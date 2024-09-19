use crate::{CanisterId, ChannelLatestMessageIndex, ChatId, CommunityId, TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
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

#[ts_export]
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
    pub local_user_index_canister_id: CanisterId,
    pub channel: ChannelLatestMessageIndex,
    pub other_default_channels: Vec<ChannelLatestMessageIndex>,
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
