use candid::Principal;
use serde::{Deserialize, Serialize};
use types::{
    CanisterId, ChannelLatestMessageIndex, ChatId, CommunityId, Document, MessageContent, MessageContentInitial, MessageId,
    MessageIndex, TimestampMillis, UniquePersonProof, User, UserId,
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
    OpenChatBotMessageV2(Box<OpenChatBotMessageV2>),
    UserDeleted(Box<UserDeleted>),
    NotifyUniquePersonProof(Box<(UserId, UniquePersonProof)>),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserRegistered {
    pub principal: Principal,
    pub user_id: UserId,
    pub username: String,
    // TODO: Deprecated
    pub referred_by: Option<UserId>,
    #[serde(default)]
    pub is_from_identity_canister: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserJoinedGroup {
    pub user_id: UserId,
    pub chat_id: ChatId,
    pub local_user_index_canister_id: CanisterId,
    pub latest_message_index: Option<MessageIndex>,
    #[serde(default)]
    pub group_canister_timestamp: TimestampMillis,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserJoinedCommunityOrChannel {
    pub user_id: UserId,
    pub community_id: CommunityId,
    pub local_user_index_canister_id: CanisterId,
    pub channels: Vec<ChannelLatestMessageIndex>,
    #[serde(default)]
    pub community_canister_timestamp: TimestampMillis,
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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OpenChatBotMessageV2 {
    pub user_id: UserId,
    pub thread_root_message_id: Option<MessageId>,
    pub content: MessageContentInitial,
    pub mentioned: Vec<User>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserDeleted {
    pub user_id: UserId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExternalAchievementInitial {
    pub name: String,
    pub logo: Document,
    pub canister_id: CanisterId,
    pub chit_reward: u32,
    pub expires: TimestampMillis,
    pub chit_budget: u32,
}
