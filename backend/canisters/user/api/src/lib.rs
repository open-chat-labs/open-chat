use candid::CandidType;
use chat_events::MessageContentInternal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{
    Achievement, CanisterId, ChannelId, ChannelLatestMessageIndex, Chat, ChatId, CommunityId, Cryptocurrency,
    DiamondMembershipPlanDuration, EventIndex, MessageContent, MessageContentInitial, MessageId, MessageIndex, Milliseconds,
    P2PSwapStatus, PhoneNumber, Reaction, ReferralStatus, SuspensionDuration, TimestampMillis, UniquePersonProof, User, UserId,
};

mod lifecycle;
mod queries;

// Need to give an alias to avoid clashing with the 'crate::queries::updates' module
#[path = "updates/mod.rs"]
mod _updates;

pub use _updates::*;
pub use lifecycle::*;
pub use queries::*;
use ts_export::ts_export;

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum EventsResponse {
    Success(types::EventsResponse),
    ChatNotFound,
    ThreadMessageNotFound,
    ReplicaNotUpToDateV2(TimestampMillis),
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatSummary {
    pub chat_id: ChatId,
    pub local_user_index_canister_id: CanisterId,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub threads_read: HashMap<MessageIndex, MessageIndex>,
    pub archived: bool,
    pub date_read_pinned: Option<TimestampMillis>,
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatSummaryUpdates {
    pub chat_id: ChatId,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub threads_read: HashMap<MessageIndex, MessageIndex>,
    pub archived: Option<bool>,
    pub date_read_pinned: Option<TimestampMillis>,
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunitySummary {
    pub community_id: CommunityId,
    pub local_user_index_canister_id: CanisterId,
    pub channels: Vec<ChannelSummary>,
    pub index: u32,
    pub archived: bool,
    pub pinned: Vec<ChannelId>,
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunitySummaryUpdates {
    pub community_id: CommunityId,
    pub channels: Vec<ChannelSummaryUpdates>,
    pub index: Option<u32>,
    pub archived: Option<bool>,
    pub pinned: Option<Vec<ChannelId>>,
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChannelSummary {
    pub channel_id: ChannelId,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub threads_read: HashMap<MessageIndex, MessageIndex>,
    pub archived: bool,
    pub date_read_pinned: Option<TimestampMillis>,
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChannelSummaryUpdates {
    pub channel_id: ChannelId,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub threads_read: HashMap<MessageIndex, MessageIndex>,
    pub archived: Option<bool>,
    pub date_read_pinned: Option<TimestampMillis>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum Event {
    UsernameChanged(Box<UsernameChanged>),
    DisplayNameChanged(Box<DisplayNameChanged>),
    PhoneNumberConfirmed(Box<PhoneNumberConfirmed>),
    StorageUpgraded(Box<StorageUpgraded>),
    ReferredUserRegistered(Box<ReferredUserRegistered>),
    UserSuspended(Box<UserSuspended>),
    // TODO: This should take MessageContentInitial
    OpenChatBotMessage(Box<MessageContent>),
    OpenChatBotMessageV2(Box<OpenChatBotMessageV2>),
    UserJoinedGroup(Box<UserJoinedGroup>),
    UserJoinedCommunityOrChannel(Box<UserJoinedCommunityOrChannel>),
    DiamondMembershipPaymentReceived(Box<DiamondMembershipPaymentReceived>),
    NotifyUniquePersonProof(Box<UniquePersonProof>),
    ExternalAchievementAwarded(Box<ExternalAchievementAwarded>),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UsernameChanged {
    pub username: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DisplayNameChanged {
    pub display_name: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PhoneNumberConfirmed {
    pub phone_number: PhoneNumber,
    pub storage_added: u64,
    pub new_storage_limit: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StorageUpgraded {
    pub cost: types::nns::CryptoAmount,
    pub storage_added: u64,
    pub new_storage_limit: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ReferredUserRegistered {
    pub user_id: UserId,
    pub username: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserSuspended {
    pub timestamp: TimestampMillis,
    pub duration: SuspensionDuration,
    pub reason: String,
    pub suspended_by: UserId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OpenChatBotMessageV2 {
    pub thread_root_message_id: Option<MessageId>,
    pub content: MessageContentInitial,
    pub mentioned: Vec<User>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserJoinedGroup {
    pub chat_id: ChatId,
    pub local_user_index_canister_id: CanisterId,
    pub latest_message_index: Option<MessageIndex>,
    pub group_canister_timestamp: TimestampMillis,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserJoinedCommunityOrChannel {
    pub community_id: CommunityId,
    pub local_user_index_canister_id: CanisterId,
    pub channels: Vec<ChannelLatestMessageIndex>,
    pub community_canister_timestamp: TimestampMillis,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
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
    DeleteMessages(Box<DeleteUndeleteMessagesArgs>),
    UndeleteMessages(Box<DeleteUndeleteMessagesArgs>),
    ToggleReaction(Box<ToggleReactionArgs>),
    TipMessage(Box<TipMessageArgs>),
    MarkMessagesRead(MarkMessagesReadArgs),
    P2PSwapStatusChange(Box<P2PSwapStatusChange>),
    StartVideoCall(Box<StartVideoCallArgs>),
    JoinVideoCall(Box<JoinVideoCall>),
    SetReferralStatus(Box<ReferralStatus>),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SendMessagesArgs {
    pub messages: Vec<SendMessageArgs>,
    pub sender_name: String,
    pub sender_display_name: Option<String>,
    pub sender_avatar_id: Option<u128>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SendMessageArgs {
    pub thread_root_message_id: Option<MessageId>,
    pub message_id: MessageId,
    pub sender_message_index: MessageIndex,
    pub content: MessageContentInternal,
    pub replies_to: Option<C2CReplyContext>,
    pub forwarding: bool,
    pub block_level_markdown: bool,
    pub message_filter_failed: Option<u64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum C2CReplyContext {
    ThisChat(MessageId),
    OtherChat(Chat, Option<MessageIndex>, EventIndex),
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DeleteUndeleteMessagesArgs {
    pub thread_root_message_id: Option<MessageId>,
    pub message_ids: Vec<MessageId>,
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct EditMessageArgs {
    pub thread_root_message_id: Option<MessageId>,
    pub message_id: MessageId,
    pub content: MessageContent,
    pub block_level_markdown: Option<bool>,
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ToggleReactionArgs {
    pub thread_root_message_id: Option<MessageId>,
    pub message_id: MessageId,
    pub reaction: Reaction,
    pub added: bool,
    pub username: String,
    pub display_name: Option<String>,
    pub user_avatar_id: Option<u128>,
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TipMessageArgs {
    pub thread_root_message_id: Option<MessageId>,
    pub message_id: MessageId,
    pub ledger: CanisterId,
    pub token: Cryptocurrency,
    pub amount: u128,
    pub decimals: u8,
    pub username: String,
    pub display_name: Option<String>,
    pub user_avatar_id: Option<u128>,
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MarkMessagesReadArgs {
    pub read_up_to: MessageIndex,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct P2PSwapStatusChange {
    pub thread_root_message_id: Option<MessageId>,
    pub message_id: MessageId,
    pub status: P2PSwapStatus,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StartVideoCallArgs {
    pub message_id: MessageId,
    pub message_index: MessageIndex,
    pub max_duration: Option<Milliseconds>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct JoinVideoCall {
    pub message_id: MessageId,
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

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum ChatInList {
    Direct(ChatId),
    Group(ChatId),
    Favourite(Chat),
    Community(CommunityId, ChannelId),
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct NamedAccount {
    pub name: String,
    pub account: String,
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum WalletConfig {
    Auto(AutoWallet),
    Manual(ManualWallet),
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct AutoWallet {
    pub min_cents_visible: u32,
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct ManualWallet {
    #[ts(as = "Vec<ts_export::TSBytes>")]
    pub tokens: Vec<CanisterId>,
}

impl Default for WalletConfig {
    fn default() -> Self {
        WalletConfig::Auto(AutoWallet::default())
    }
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Referral {
    pub user_id: UserId,
    pub status: ReferralStatus,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Referrals {
    pub referred_by: Option<UserId>,
    pub referrals: Vec<Referral>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ExternalAchievementAwarded {
    pub name: String,
    pub chit_reward: u32,
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MessageActivityEvent {
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub event_index: EventIndex,
    pub activity: MessageActivity,
    pub timestamp: TimestampMillis,
    pub user_id: Option<UserId>,
}

impl MessageActivityEvent {
    pub fn matches(&self, event: &MessageActivityEvent) -> bool {
        self.chat == event.chat
            && self.thread_root_message_index == event.thread_root_message_index
            && self.message_index == event.message_index
            && self.activity == event.activity
    }
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Eq, PartialEq, Debug)]
pub enum MessageActivity {
    Mention,
    Reaction,
    QuoteReply,
    Tip,
    Crypto,
    PollVote,
    P2PSwapAccepted,
}

#[ts_export(user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct MessageActivitySummary {
    pub read_up_to: TimestampMillis,
    pub latest_event_timestamp: TimestampMillis,
    pub unread_count: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum CommunityCanisterEvent {
    MessageActivity(MessageActivityEvent),
    Achievement(Achievement),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum GroupCanisterEvent {
    MessageActivity(MessageActivityEvent),
    Achievement(Achievement),
}
