use candid::{CandidType, Deserialize};
use serde::Serialize;
use types::{
    CanisterId, ChannelLatestMessageIndex, ChatId, CommunityId, Milliseconds, PublicCommunityActivity, PublicGroupActivity,
    UserId,
};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ChildCanisterType {
    Group,
    Community,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum UserIndexEvent {
    NotifyOfUserDeleted(CanisterId, UserId),
}

// The LocalUserIndexes' events, each relaying one from a group or community on its subnet
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum LocalIndexEvent {
    GroupActive(GroupActive),
    CommunityActive(CommunityActive),
    GroupImportComplete(Box<GroupImportComplete>),
    CommunityUninstalled(CommunityId),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupActive {
    pub chat_id: ChatId,
    pub duration: Milliseconds,
    pub public_group_activity: Option<PublicGroupActivity>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CommunityActive {
    pub community_id: CommunityId,
    pub duration: Milliseconds,
    pub public_community_activity: Option<PublicCommunityActivity>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupImportComplete {
    pub community_id: CommunityId,
    pub community_name: String,
    pub local_user_index_canister_id: CanisterId,
    pub channel: ChannelLatestMessageIndex,
    pub group_id: ChatId,
    pub group_name: String,
    pub members: Vec<UserId>,
    pub other_public_channels: Vec<ChannelLatestMessageIndex>,
    pub mark_active_duration: Milliseconds,
    pub public_community_activity: Option<PublicCommunityActivity>,
}
