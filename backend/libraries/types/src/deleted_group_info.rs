use crate::{ChatId, CommunityId, TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
#[serde(from = "DeletedGroupInfoPrevious")]
pub struct DeletedGroupInfo {
    pub id: ChatId,
    pub timestamp: TimestampMillis,
    pub deleted_by: UserId,
    pub group_name: String,
    pub name: String,
    pub public: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct DeletedGroupInfoPrevious {
    pub id: ChatId,
    pub timestamp: TimestampMillis,
    pub deleted_by: UserId,
    pub group_name: String,
    pub public: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct DeletedCommunityInfo {
    pub id: CommunityId,
    pub timestamp: TimestampMillis,
    pub deleted_by: UserId,
    pub name: String,
    pub public: bool,
}

impl From<DeletedGroupInfoPrevious> for DeletedGroupInfo {
    fn from(value: DeletedGroupInfoPrevious) -> Self {
        DeletedGroupInfo {
            id: value.id,
            timestamp: value.timestamp,
            deleted_by: value.deleted_by,
            group_name: value.group_name.clone(),
            name: value.group_name,
            public: value.public,
        }
    }
}
