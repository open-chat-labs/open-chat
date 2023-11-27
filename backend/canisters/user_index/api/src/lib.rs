use candid::Principal;
use serde::{Deserialize, Serialize};
use types::{
    local_user_index_canister_id, CanisterId, ChannelLatestMessageIndex, ChatId, CommunityId, MessageContent, MessageIndex,
    UserId,
};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum Event {
    UserRegistered(Box<UserRegistered>),
    UserJoinedGroup(Box<UserJoinedGroup>),
    UserJoinedCommunityOrChannel(Box<UserJoinedCommunityOrChannel>),
    JoinUserToGroup(Box<JoinUserToGroup>),
    OpenChatBotMessage(Box<OpenChatBotMessage>),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserRegistered {
    pub principal: Principal,
    pub user_id: UserId,
    pub username: String,
    pub display_name: Option<String>,
    pub referred_by: Option<UserId>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(from = "UserJoinedGroupPrevious")]
pub struct UserJoinedGroup {
    pub user_id: UserId,
    pub chat_id: ChatId,
    pub local_user_index_canister_id: CanisterId,
    pub latest_message_index: Option<MessageIndex>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserJoinedGroupPrevious {
    pub user_id: UserId,
    pub chat_id: ChatId,
    pub latest_message_index: Option<MessageIndex>,
}

impl From<UserJoinedGroupPrevious> for UserJoinedGroup {
    fn from(value: UserJoinedGroupPrevious) -> Self {
        UserJoinedGroup {
            user_id: value.user_id,
            chat_id: value.chat_id,
            local_user_index_canister_id: local_user_index_canister_id(value.chat_id.into()),
            latest_message_index: value.latest_message_index,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(from = "UserJoinedCommunityOrChannelPrevious")]
pub struct UserJoinedCommunityOrChannel {
    pub user_id: UserId,
    pub community_id: CommunityId,
    pub local_user_index_canister_id: CanisterId,
    pub channels: Vec<ChannelLatestMessageIndex>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserJoinedCommunityOrChannelPrevious {
    pub user_id: UserId,
    pub community_id: CommunityId,
    pub channels: Vec<ChannelLatestMessageIndex>,
}

impl From<UserJoinedCommunityOrChannelPrevious> for UserJoinedCommunityOrChannel {
    fn from(value: UserJoinedCommunityOrChannelPrevious) -> Self {
        UserJoinedCommunityOrChannel {
            user_id: value.user_id,
            community_id: value.community_id,
            local_user_index_canister_id: local_user_index_canister_id(value.community_id.into()),
            channels: value.channels,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct JoinUserToGroup {
    pub user_id: UserId,
    pub chat_id: ChatId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OpenChatBotMessage {
    pub user_id: UserId,
    pub message: MessageContent,
}
