use candid::Principal;
use serde::{Deserialize, Serialize};
use types::{ChatId, CommunityId, MessageContent, MessageIndex, UserId};

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
    UserJoinedCommunity(Box<UserJoinedCommunity>),
    JoinUserToGroup(Box<JoinUserToGroup>),
    OpenChatBotMessage(Box<OpenChatBotMessage>),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserRegistered {
    pub principal: Principal,
    pub user_id: UserId,
    pub username: String,
    pub referred_by: Option<UserId>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserJoinedGroup {
    pub user_id: UserId,
    pub chat_id: ChatId,
    pub as_super_admin: bool,
    pub latest_message_index: Option<MessageIndex>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserJoinedCommunity {
    pub user_id: UserId,
    pub community_id: CommunityId,
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
