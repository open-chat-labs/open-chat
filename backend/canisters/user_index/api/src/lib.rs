use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{
    CanisterId, ChannelLatestMessageIndex, ChatId, CommunityId, MessageContent, MessageContentInitial, MessageId, MessageIndex,
    NotifyChit, StreakInsuranceClaim, StreakInsurancePayment, TimestampMillis, UniquePersonProof, User, UserId,
};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum LocalUserIndexEvent {
    UserRegistered(Box<UserRegistered>),
    UserJoinedGroup(Box<UserJoinedGroup>),
    UserJoinedCommunityOrChannel(Box<UserJoinedCommunityOrChannel>),
    JoinUserToGroup(Box<JoinUserToGroup>),
    OpenChatBotMessage(Box<OpenChatBotMessage>),
    OpenChatBotMessageV2(Box<OpenChatBotMessageV2>),
    UserDeleted(Box<UserDeleted>),
    NotifyUniquePersonProof(Box<(UserId, UniquePersonProof)>),
    NotifyChit(Box<(UserId, NotifyChit)>),
    NotifyStreakInsurancePayment(Box<StreakInsurancePayment>),
    NotifyStreakInsuranceClaim(Box<StreakInsuranceClaim>),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserRegistered {
    pub principal: Principal,
    pub user_id: UserId,
    pub username: String,
    pub referred_by: Option<UserId>,
    pub is_from_identity_canister: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserJoinedGroup {
    pub user_id: UserId,
    pub chat_id: ChatId,
    pub local_user_index_canister_id: CanisterId,
    pub latest_message_index: Option<MessageIndex>,
    pub group_canister_timestamp: TimestampMillis,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserJoinedCommunityOrChannel {
    pub user_id: UserId,
    pub community_id: CommunityId,
    pub local_user_index_canister_id: CanisterId,
    pub channels: Vec<ChannelLatestMessageIndex>,
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
    pub id: u32,
    pub name: String,
    pub logo: String,
    pub url: String,
    pub canister_id: CanisterId,
    pub chit_reward: u32,
    pub expires: TimestampMillis,
    pub chit_budget: u32,
    pub submitted_by: UserId,
    pub payment_block_index: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ChildCanisterType {
    LocalUserIndex,
    User,
}
