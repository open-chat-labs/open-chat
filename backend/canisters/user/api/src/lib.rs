use crate::c2c_delete_messages::Args as DeleteMessagesArgs;
use crate::c2c_edit_message::Args as EditMessageArgs;
use crate::c2c_mark_read_v2::Args as MarkMessagesReadArgs;
use crate::c2c_send_messages_v2::Args as SendMessagesArgs;
use crate::c2c_tip_message::Args as TipMessageArgs;
use crate::c2c_toggle_reaction::Args as ToggleReactionArgs;
use crate::c2c_undelete_messages::Args as UndeleteMessagesArgs;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{
    CanisterId, ChannelId, ChannelLatestMessageIndex, Chat, ChatId, CommunityId, Cryptocurrency, DiamondMembershipPlanDuration,
    MessageContent, MessageId, MessageIndex, P2PSwapStatus, PhoneNumber, SuspensionDuration, TimestampMillis, UserId,
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
    ReplicaNotUpToDateV2(TimestampMillis),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatSummary {
    pub chat_id: ChatId,
    pub local_user_index_canister_id: CanisterId,
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
    pub local_user_index_canister_id: CanisterId,
    pub channels: Vec<ChannelSummary>,
    pub index: u32,
    pub archived: bool,
    pub pinned: Vec<ChannelId>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunitySummaryUpdates {
    pub community_id: CommunityId,
    pub channels: Vec<ChannelSummaryUpdates>,
    pub index: Option<u32>,
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
    DisplayNameChanged(Box<DisplayNameChanged>),
    PhoneNumberConfirmed(Box<PhoneNumberConfirmed>),
    StorageUpgraded(Box<StorageUpgraded>),
    ReferredUserRegistered(Box<ReferredUserRegistered>),
    UserSuspended(Box<UserSuspended>),
    // TODO: This should take MessageContentInitial
    OpenChatBotMessage(Box<MessageContent>),
    UserJoinedGroup(Box<UserJoinedGroup>),
    UserJoinedCommunityOrChannel(Box<UserJoinedCommunityOrChannel>),
    DiamondMembershipPaymentReceived(Box<DiamondMembershipPaymentReceived>),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UsernameChanged {
    pub username: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DisplayNameChanged {
    pub display_name: Option<String>,
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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UserSuspended {
    pub timestamp: TimestampMillis,
    pub duration: SuspensionDuration,
    pub reason: String,
    pub suspended_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UserJoinedGroup {
    pub chat_id: ChatId,
    pub local_user_index_canister_id: CanisterId,
    pub latest_message_index: Option<MessageIndex>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UserJoinedCommunityOrChannel {
    pub community_id: CommunityId,
    pub local_user_index_canister_id: CanisterId,
    pub channels: Vec<ChannelLatestMessageIndex>,
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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum UserCanisterEvent {
    SendMessages(Box<SendMessagesArgs>),
    EditMessage(Box<EditMessageArgs>),
    DeleteMessages(Box<DeleteMessagesArgs>),
    UndeleteMessages(Box<UndeleteMessagesArgs>),
    ToggleReaction(Box<ToggleReactionArgs>),
    TipMessage(Box<TipMessageArgs>),
    MarkMessagesRead(MarkMessagesReadArgs),
    P2PSwapStatusChange(Box<P2PSwapStatusChange>),
    JoinVideoCall(Box<JoinVideoCall>),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct P2PSwapStatusChange {
    pub message_id: MessageId,
    pub status: P2PSwapStatus,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct JoinVideoCall {
    pub message_index: MessageIndex,
}

pub fn map_chats_to_chat_ids(chats: Vec<Chat>) -> Vec<ChatId> {
    chats
        .into_iter()
        .filter_map(|c| match c {
            Chat::Direct(c) => Some(c),
            Chat::Group(c) => Some(c),
            Chat::Channel(_, _) => None,
        })
        .collect()
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum ChatInList {
    Direct(ChatId),
    Group(ChatId),
    Favourite(Chat),
    Community(CommunityId, ChannelId),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct NamedAccount {
    pub name: String,
    pub account: String,
}
