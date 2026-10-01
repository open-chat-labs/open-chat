#![expect(deprecated)]
use chat_events::MessageContentInternal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{
    Achievement, BotDefinitionUpdate, CanisterId, ChannelId, ChannelLatestMessageIndex, Chat, ChatId, CommunityId,
    DiamondMembershipPlanDuration, EventIndex, Hash, IdempotentEnvelope, MessageContent, MessageContentInitial, MessageId,
    MessageIndex, Milliseconds, OgPreview, P2PSwapLocation, P2PSwapStatus, PhoneNumber, Reaction, ReferralStatus,
    SuspensionDuration, TimestampMillis, TokenInfo, UniquePersonProof, User, UserId,
};

mod lifecycle;
mod queries;

// Need to give an alias to avoid clashing with the 'crate::queries::updates' module
#[path = "updates/mod.rs"]
mod _updates;

pub use _updates::*;
pub use lifecycle::*;
use oc_error_codes::OCError;
pub use queries::*;
use ts_export::ts_export;

#[ts_export(user)]
#[derive(Serialize, Deserialize, Debug)]
pub enum EventsResponse {
    Success(types::EventsResponse),
    Error(OCError),
}

#[ts_export(user)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatSummary {
    pub chat_id: ChatId,
    pub local_user_index_canister_id: CanisterId,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub threads_read: HashMap<MessageIndex, MessageIndex>,
    pub archived: bool,
    pub date_read_pinned: Option<TimestampMillis>,
}

#[ts_export(user)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatSummaryUpdates {
    pub chat_id: ChatId,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub threads_read: HashMap<MessageIndex, MessageIndex>,
    pub archived: Option<bool>,
    pub date_read_pinned: Option<TimestampMillis>,
}

#[ts_export(user)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CommunitySummary {
    pub community_id: CommunityId,
    pub local_user_index_canister_id: CanisterId,
    pub channels: Vec<ChannelSummary>,
    pub index: u32,
    pub archived: bool,
    pub pinned: Vec<ChannelId>,
}

#[ts_export(user)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CommunitySummaryUpdates {
    pub community_id: CommunityId,
    pub channels: Vec<ChannelSummaryUpdates>,
    pub index: Option<u32>,
    pub archived: Option<bool>,
    pub pinned: Option<Vec<ChannelId>>,
}

#[ts_export(user)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChannelSummary {
    pub channel_id: ChannelId,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub threads_read: HashMap<MessageIndex, MessageIndex>,
    pub archived: bool,
    pub date_read_pinned: Option<TimestampMillis>,
}

#[ts_export(user)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChannelSummaryUpdates {
    pub channel_id: ChannelId,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub threads_read: HashMap<MessageIndex, MessageIndex>,
    pub archived: Option<bool>,
    pub date_read_pinned: Option<TimestampMillis>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum LocalUserIndexEvent {
    UsernameChanged(Box<UsernameChanged>),
    DisplayNameChanged(Box<DisplayNameChanged>),
    PhoneNumberConfirmed(Box<PhoneNumberConfirmed>),
    StorageUpgraded(Box<StorageUpgraded>),
    ReferredUserRegistered(Box<ReferredUserRegistered>),
    UserSuspended(Box<UserSuspended>),
    OpenChatBotMessageV2(Box<OpenChatBotMessageV2>),
    UserJoinedGroup(Box<UserJoinedGroup>),
    UserJoinedCommunityOrChannel(Box<UserJoinedCommunityOrChannel>),
    DiamondMembershipPaymentReceived(Box<DiamondMembershipPaymentReceived>),
    NotifyUniquePersonProof(Box<UniquePersonProof>),
    ExternalAchievementAwarded(Box<ExternalAchievementAwarded>),
    ReinstateMissedDailyClaims(Vec<u16>),
    BotUpdated(Box<BotDefinitionUpdate>),
    BotRemoved(UserId),
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
    pub ledger: CanisterId,
    pub token_symbol: String,
    pub token: Option<types::Cryptocurrency>,
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
    SetEventsTtl(Box<SetEventsTtl>),
    SetReferralStatusV2(Box<SetReferralStatusV2>),
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
    #[serde(default)]
    pub og_previews: Vec<OgPreview>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum C2CReplyContext {
    ThisChat(MessageId),
    OtherChat(Chat, Option<MessageIndex>, EventIndex),
}

#[ts_export(user)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DeleteUndeleteMessagesArgs {
    pub thread_root_message_id: Option<MessageId>,
    pub message_ids: Vec<MessageId>,
}

#[ts_export(user)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EditMessageArgs {
    pub thread_root_message_id: Option<MessageId>,
    pub message_id: MessageId,
    pub content: MessageContent,
    pub block_level_markdown: Option<bool>,
    #[serde(default)]
    pub og_previews: Vec<OgPreview>,
}

#[ts_export(user)]
#[derive(Serialize, Deserialize, Clone, Debug)]
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
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TipMessageArgs {
    pub thread_root_message_id: Option<MessageId>,
    pub message_id: MessageId,
    pub ledger: CanisterId,
    pub token_symbol: String,
    pub amount: u128,
    pub decimals: u8,
    pub username: String,
    pub display_name: Option<String>,
    pub user_avatar_id: Option<u128>,
}

#[ts_export(user)]
#[derive(Serialize, Deserialize, Clone, Debug)]
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
    // Absent when the other user's canister predates audio calls
    #[serde(default)]
    pub audio_only: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct JoinVideoCall {
    pub message_id: MessageId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SetEventsTtl {
    pub events_ttl: Option<Milliseconds>,
    pub timestamp: TimestampMillis,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SetReferralStatusV2 {
    pub status: ReferralStatus,
    // The ids the referred user had before being migrated to a MultiUser canister, oldest first, any
    // of which the referrer may hold their referral under
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub previous_user_ids: Vec<UserId>,
}

// Identifies a migration of a user to a MultiUser canister: the hash of the user as serialized when
// the migration started, along with when it started, so that each migration of a user is told apart
// even if the user hasn't changed in between
pub fn migration_hash(user: &[u8], started: TimestampMillis) -> Hash {
    sha256::sha256_of_parts([started.to_be_bytes().as_slice(), user])
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
#[derive(Serialize, Deserialize, Debug)]
pub enum ChatInList {
    Direct(ChatId),
    Group(ChatId),
    Favourite(Chat),
    Community(CommunityId, ChannelId),
}

#[ts_export(user)]
#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct NamedAccount {
    pub name: String,
    pub account: String,
}

#[ts_export(user)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum WalletConfig {
    Auto(AutoWallet),
    Manual(ManualWallet),
}

#[ts_export(user)]
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct AutoWallet {
    pub min_cents_visible: u32,
}

#[ts_export(user)]
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ManualWallet {
    #[ts(as = "Vec<ts_export::TSPrincipal>")]
    pub tokens: Vec<CanisterId>,
}

impl Default for WalletConfig {
    fn default() -> Self {
        WalletConfig::Auto(AutoWallet::default())
    }
}

#[ts_export(user)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Referral {
    pub user_id: UserId,
    pub status: ReferralStatus,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Referrals {
    pub referred_by: Option<UserId>,
    pub referrals: Vec<Referral>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExternalAchievementAwarded {
    pub name: String,
    pub chit_reward: u32,
}

#[ts_export(user)]
#[derive(Serialize, Deserialize, Clone, Debug)]
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
#[derive(Serialize, Deserialize, Clone, Copy, Eq, PartialEq, Debug)]
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
#[derive(Serialize, Deserialize, Debug)]
pub struct MessageActivitySummary {
    pub read_up_to: TimestampMillis,
    pub latest_event_timestamp: TimestampMillis,
    pub unread_count: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum CommunityCanisterEvent {
    MessageActivity(MessageActivityEvent),
    Achievement(Achievement),
    P2PSwapCreated(Box<P2PSwapCreated>),
    RemovedFromCommunity(Box<RemovedFromCommunity>),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum GroupCanisterEvent {
    MessageActivity(MessageActivityEvent),
    Achievement(Achievement),
    P2PSwapCreated(Box<P2PSwapCreated>),
    RemovedFromGroup(Box<RemovedFromGroup>),
}

// The user was removed, or blocked, from the group sending the event
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RemovedFromGroup {
    pub removed_by: UserId,
    pub blocked: bool,
    pub group_name: String,
    pub public: bool,
}

// The user was removed, or blocked, from the community sending the event
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RemovedFromCommunity {
    pub removed_by: UserId,
    pub blocked: bool,
    pub community_name: String,
    pub public: bool,
}

// A group or community sends removals to the user's canister apart from the other events, so that a
// canister on a version which doesn't know of them ignores them, rather than failing to read the whole
// batch, which would then be retried until the canister was upgraded. Such a canister is also told
// directly, by `c2c_remove_from_group` / `c2c_remove_from_community`.
// TODO: Send removals among the other events once every User canister knows of them
fn split_out_removals<T, R>(
    events: Vec<IdempotentEnvelope<T>>,
    classify: impl Fn(T) -> EventOrRemoval<T, R>,
) -> (Vec<IdempotentEnvelope<T>>, Vec<IdempotentEnvelope<R>>) {
    let mut others = Vec::new();
    let mut removals = Vec::new();
    for event in events {
        match classify(event.value) {
            EventOrRemoval::Removal(value) => removals.push(IdempotentEnvelope {
                created_at: event.created_at,
                idempotency_id: event.idempotency_id,
                value,
            }),
            EventOrRemoval::Event(value) => others.push(IdempotentEnvelope {
                created_at: event.created_at,
                idempotency_id: event.idempotency_id,
                value,
            }),
        }
    }
    (others, removals)
}

enum EventOrRemoval<T, R> {
    Event(T),
    Removal(R),
}

// Puts the removals back among the other events, in the order they were created, since the
// idempotency checker drops any event older than the latest it has had from the same canister
fn merge_in_removals<T, R>(
    mut events: Vec<IdempotentEnvelope<T>>,
    removals: Vec<IdempotentEnvelope<R>>,
    into_event: impl Fn(R) -> T,
) -> Vec<IdempotentEnvelope<T>> {
    if !removals.is_empty() {
        events.extend(removals.into_iter().map(|removal| IdempotentEnvelope {
            created_at: removal.created_at,
            idempotency_id: removal.idempotency_id,
            value: into_event(removal.value),
        }));
        events.sort_by_key(|event| event.created_at);
    }
    events
}

// A P2P swap the user created directly in a group or community rather than via their own canister,
// which the group or community tells them of so that it is recorded against them just the same
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct P2PSwapCreated {
    pub swap_id: u32,
    pub location: P2PSwapLocation,
    pub token0: TokenInfo,
    pub token0_amount: u128,
    pub token1: TokenInfo,
    pub token1_amount: u128,
    pub expires_at: TimestampMillis,
    pub created: TimestampMillis,
}
