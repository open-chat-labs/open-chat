use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{
    ChannelId, Chat, ChatId, CommunityId, Cryptocurrency, DiamondMembershipPlanDuration, EventIndex, MessageContent,
    MessageIndex, PhoneNumber, SuspensionDuration, TimestampMillis, UserId,
};

mod lifecycle;
mod queries;

// Need to give an alias to avoid clashing with the 'crate::queries::updates' module
#[path = "updates/mod.rs"]
mod _updates;

pub use _updates::*;
pub use lifecycle::*;
pub use queries::*;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum EventsResponse {
    Success(types::EventsResponse),
    ChatNotFound,
    ReplicaNotUpToDate(EventIndex),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatSummary {
    pub chat_id: ChatId,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub threads_read: HashMap<MessageIndex, MessageIndex>,
    pub archived: bool,
    pub date_read_pinned: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatSummaryUpdates {
    pub chat_id: ChatId,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub threads_read: HashMap<MessageIndex, MessageIndex>,
    pub archived: Option<bool>,
    pub date_read_pinned: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunitySummary {
    pub community_id: CommunityId,
    pub channels: Vec<ChannelSummary>,
    pub archived: bool,
    pub pinned: Vec<ChannelId>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunitySummaryUpdates {
    pub community_id: CommunityId,
    pub channels: Vec<ChannelSummaryUpdates>,
    pub archived: Option<bool>,
    pub pinned: Option<Vec<ChannelId>>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChannelSummary {
    pub channel_id: ChannelId,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub threads_read: HashMap<MessageIndex, MessageIndex>,
    pub archived: bool,
    pub date_read_pinned: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChannelSummaryUpdates {
    pub channel_id: ChannelId,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub threads_read: HashMap<MessageIndex, MessageIndex>,
    pub archived: Option<bool>,
    pub date_read_pinned: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum Event {
    UsernameChanged(Box<UsernameChanged>),
    PhoneNumberConfirmed(Box<PhoneNumberConfirmed>),
    StorageUpgraded(Box<StorageUpgraded>),
    ReferredUserRegistered(Box<ReferredUserRegistered>),
    UserSuspended(Box<UserSuspended>),
    OpenChatBotMessage(Box<MessageContent>),
    UserJoinedGroup(Box<UserJoinedGroup>),
    UserJoinedCommunity(Box<UserJoinedCommunity>),
    DiamondMembershipPaymentReceived(Box<DiamondMembershipPaymentReceived>),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UsernameChanged {
    pub username: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PhoneNumberConfirmed {
    pub phone_number: PhoneNumber,
    pub storage_added: u64,
    pub new_storage_limit: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct StorageUpgraded {
    pub cost: types::nns::CryptoAmount,
    pub storage_added: u64,
    pub new_storage_limit: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ReferredUserRegistered {
    pub user_id: UserId,
    pub username: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct UserSuspended {
    pub timestamp: TimestampMillis,
    pub duration: SuspensionDuration,
    pub reason: String,
    pub suspended_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct UserJoinedGroup {
    pub chat_id: ChatId,
    pub latest_message_index: Option<MessageIndex>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct UserJoinedCommunity {
    pub community_id: CommunityId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DiamondMembershipPaymentReceived {
    pub timestamp: TimestampMillis,
    pub expires_at: TimestampMillis,
    pub token: Cryptocurrency,
    pub amount_e8s: u64,
    pub block_index: u64,
    pub duration: DiamondMembershipPlanDuration,
    pub recurring: bool,
    pub send_bot_message: bool,
}

pub fn map_chats_to_chat_ids(chats: Vec<Chat>) -> Vec<ChatId> {
    chats
        .iter()
        .filter_map(|c| match c {
            Chat::Direct(c) => Some(*c),
            Chat::Group(c) => Some(*c),
            Chat::Channel(_, _) => None,
        })
        .collect()
}
