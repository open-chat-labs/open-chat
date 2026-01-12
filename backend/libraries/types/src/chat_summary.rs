use crate::{
    AccessGateConfig, BuildVersion, CanisterId, ChatId, EventIndex, EventWrapper, FrozenGroupInfo, GroupMember,
    GroupPermissions, GroupRole, HydratedMention, InstalledBotDetails, Message, MessageId, MessageIndex, Milliseconds,
    OptionUpdate, TimestampMillis, UserId, Version, WebhookDetails, is_default,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

pub const MAX_THREADS_IN_SUMMARY: usize = 20;

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DirectChatSummary {
    pub them: UserId,
    pub last_updated: TimestampMillis,
    #[ts(as = "Option<crate::EventWrapperMessage>")]
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub latest_message_index: Option<MessageIndex>,
    pub date_created: TimestampMillis,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub read_by_them_up_to: Option<MessageIndex>,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub notifications_muted: bool,
    pub metrics: ChatMetrics,
    pub my_metrics: ChatMetrics,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub archived: bool,
    pub events_ttl: Option<Milliseconds>,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<TimestampMillis>", optional)]
    pub events_ttl_last_updated: TimestampMillis,
    pub video_call_in_progress: Option<VideoCall>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DirectChatSummaryUpdates {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    #[ts(as = "Option<crate::EventWrapperMessage>")]
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: Option<EventIndex>,
    pub latest_message_index: Option<MessageIndex>,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub read_by_them_up_to: Option<MessageIndex>,
    pub notifications_muted: Option<bool>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<(EventIndex, TimestampMillis)>>", optional)]
    pub updated_events: Vec<(EventIndex, TimestampMillis)>,
    pub metrics: Option<ChatMetrics>,
    pub my_metrics: Option<ChatMetrics>,
    pub archived: Option<bool>,
    #[serde(default, skip_serializing_if = "OptionUpdate::is_empty")]
    #[ts(as = "Option<crate::OptionUpdateU64>", optional)]
    pub events_ttl: OptionUpdate<Milliseconds>,
    pub events_ttl_last_updated: Option<TimestampMillis>,
    #[serde(default, skip_serializing_if = "OptionUpdate::is_empty")]
    #[ts(as = "Option<crate::OptionUpdateVideoCall>", optional)]
    pub video_call_in_progress: OptionUpdate<VideoCall>,
}

// TODO: This type is used in the response from group::public_summary and group_index::recommended_groups
// which is causing unnecessarily coupling. We should use separate types for these use cases.
// For instance we only need to return history_visible_to_new_joiners and is_public from group::public_summary
#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PublicGroupSummary {
    pub chat_id: ChatId,
    pub local_user_index_canister_id: CanisterId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    pub subtype: Option<GroupSubtype>,
    pub history_visible_to_new_joiners: bool,
    pub messages_visible_to_non_members: bool,
    pub avatar_id: Option<u128>,
    #[ts(as = "Option<crate::EventWrapperMessage>")]
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub latest_message_index: Option<MessageIndex>,
    pub participant_count: u32,
    pub wasm_version: BuildVersion,
    pub is_public: bool,
    pub frozen: Option<FrozenGroupInfo>,
    pub events_ttl: Option<Milliseconds>,
    pub events_ttl_last_updated: TimestampMillis,
    pub gate_config: Option<AccessGateConfig>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupCanisterGroupChatSummary {
    pub chat_id: ChatId,
    pub local_user_index_canister_id: CanisterId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    pub subtype: Option<GroupSubtype>,
    pub avatar_id: Option<u128>,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub is_public: bool,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub history_visible_to_new_joiners: bool,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub messages_visible_to_non_members: bool,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<EventIndex>", optional)]
    pub min_visible_event_index: EventIndex,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<MessageIndex>", optional)]
    pub min_visible_message_index: MessageIndex,
    #[ts(as = "Option<crate::EventWrapperMessage>")]
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub latest_message_index: Option<MessageIndex>,
    pub participant_count: u32,
    pub wasm_version: BuildVersion,
    pub permissions_v2: GroupPermissions,
    pub metrics: ChatMetrics,
    pub frozen: Option<FrozenGroupInfo>,
    pub date_last_pinned: Option<TimestampMillis>,
    pub events_ttl: Option<Milliseconds>,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<TimestampMillis>", optional)]
    pub events_ttl_last_updated: TimestampMillis,
    pub gate_config: Option<AccessGateConfig>,
    pub membership: Option<GroupMembership>,
    pub video_call_in_progress: Option<VideoCall>,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub verified: bool,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupCanisterGroupChatSummaryUpdates {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub name: Option<String>,
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "OptionUpdate::is_empty")]
    #[ts(as = "Option<crate::OptionUpdateGroupSubtype>", optional)]
    pub subtype: OptionUpdate<GroupSubtype>,
    #[serde(default, skip_serializing_if = "OptionUpdate::is_empty")]
    #[ts(as = "Option<crate::OptionUpdateU128>", optional)]
    pub avatar_id: OptionUpdate<u128>,
    #[ts(as = "Option<crate::EventWrapperMessage>")]
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: Option<EventIndex>,
    pub latest_message_index: Option<MessageIndex>,
    pub participant_count: Option<u32>,
    pub wasm_version: Option<BuildVersion>,
    pub permissions_v2: Option<GroupPermissions>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<(Option<MessageIndex>, EventIndex, TimestampMillis)>>", optional)]
    pub updated_events: Vec<(Option<MessageIndex>, EventIndex, TimestampMillis)>, // (Thread root message index, event index, timestamp)
    pub metrics: Option<ChatMetrics>,
    pub is_public: Option<bool>,
    pub messages_visible_to_non_members: Option<bool>,
    #[serde(default, skip_serializing_if = "OptionUpdate::is_empty")]
    #[ts(as = "Option<crate::OptionUpdateFrozenGroupInfo>", optional)]
    pub frozen: OptionUpdate<FrozenGroupInfo>,
    pub date_last_pinned: Option<TimestampMillis>,
    #[serde(default, skip_serializing_if = "OptionUpdate::is_empty")]
    #[ts(as = "Option<crate::OptionUpdateU64>", optional)]
    pub events_ttl: OptionUpdate<Milliseconds>,
    pub events_ttl_last_updated: Option<TimestampMillis>,
    #[serde(default, skip_serializing_if = "OptionUpdate::is_empty")]
    #[ts(as = "Option<crate::OptionUpdateAccessGateConfig>", optional)]
    pub gate_config: OptionUpdate<AccessGateConfig>,
    pub membership: Option<GroupMembershipUpdates>,
    #[serde(default, skip_serializing_if = "OptionUpdate::is_empty")]
    #[ts(as = "Option<crate::OptionUpdateVideoCall>", optional)]
    pub video_call_in_progress: OptionUpdate<VideoCall>,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub any_updates_missed: bool,
    pub verified: Option<bool>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupMembership {
    pub joined: TimestampMillis,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<GroupRole>", optional)]
    pub role: GroupRole,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<HydratedMention>>", optional)]
    pub mentions: Vec<HydratedMention>,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub notifications_muted: bool,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub at_everyone_muted: bool,
    pub my_metrics: ChatMetrics,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<GroupCanisterThreadDetails>>", optional)]
    pub latest_threads: Vec<GroupCanisterThreadDetails>,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub rules_accepted: bool,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<bool>", optional)]
    pub lapsed: bool,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupMembershipUpdates {
    pub role: Option<GroupRole>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<HydratedMention>>", optional)]
    pub mentions: Vec<HydratedMention>,
    pub notifications_muted: Option<bool>,
    pub at_everyone_muted: Option<bool>,
    pub my_metrics: Option<ChatMetrics>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<GroupCanisterThreadDetails>>", optional)]
    pub latest_threads: Vec<GroupCanisterThreadDetails>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<MessageIndex>>", optional)]
    pub unfollowed_threads: Vec<MessageIndex>,
    pub rules_accepted: Option<bool>,
    pub lapsed: Option<bool>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
pub struct SelectedGroupUpdates {
    pub timestamp: TimestampMillis,
    pub last_updated: TimestampMillis,
    pub latest_event_index: EventIndex,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<GroupMember>>", optional)]
    pub members_added_or_updated: Vec<GroupMember>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserId>>", optional)]
    pub members_removed: Vec<UserId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<InstalledBotDetails>>", optional)]
    pub bots_added_or_updated: Vec<InstalledBotDetails>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserId>>", optional)]
    pub bots_removed: Vec<UserId>,
    pub webhooks: Option<Vec<WebhookDetails>>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserId>>", optional)]
    pub blocked_users_added: Vec<UserId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<UserId>>", optional)]
    pub blocked_users_removed: Vec<UserId>,
    pub invited_users: Option<Vec<UserId>>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<MessageIndex>>", optional)]
    pub pinned_messages_added: Vec<MessageIndex>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(as = "Option<Vec<MessageIndex>>", optional)]
    pub pinned_messages_removed: Vec<MessageIndex>,
    pub chat_rules: Option<VersionedRules>,
}

impl SelectedGroupUpdates {
    pub fn has_updates(&self) -> bool {
        !self.members_added_or_updated.is_empty()
            || !self.members_removed.is_empty()
            || !self.bots_added_or_updated.is_empty()
            || !self.bots_removed.is_empty()
            || self.webhooks.is_some()
            || !self.blocked_users_added.is_empty()
            || !self.blocked_users_removed.is_empty()
            || self.invited_users.is_some()
            || !self.pinned_messages_added.is_empty()
            || !self.pinned_messages_removed.is_empty()
            || self.chat_rules.is_some()
    }
}

#[ts_export]
#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct ChatMetrics {
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub text_messages: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub image_messages: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub video_messages: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub audio_messages: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub file_messages: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub polls: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub poll_votes: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub crypto_messages: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub deleted_messages: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub giphy_messages: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub prize_messages: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub prize_winner_messages: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub replies: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub edits: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub reactions: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub proposals: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub reported_messages: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub message_reminders: u32,
    #[serde(default, skip_serializing_if = "is_default")]
    #[ts(as = "Option<u32>", optional)]
    pub custom_type_messages: u32,
    pub last_active: TimestampMillis,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ThreadSyncDetails {
    pub root_message_index: MessageIndex,
    pub latest_event: Option<EventIndex>,
    pub latest_message: Option<MessageIndex>,
    pub read_up_to: Option<MessageIndex>,
    pub last_updated: TimestampMillis,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupCanisterThreadDetails {
    pub root_message_index: MessageIndex,
    pub latest_event: EventIndex,
    pub latest_message: MessageIndex,
    pub last_updated: TimestampMillis,
}

impl From<&GroupCanisterThreadDetails> for ThreadSyncDetails {
    fn from(s: &GroupCanisterThreadDetails) -> Self {
        ThreadSyncDetails {
            root_message_index: s.root_message_index,
            latest_event: Some(s.latest_event),
            latest_message: Some(s.latest_message),
            last_updated: s.last_updated,
            read_up_to: None,
        }
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum GroupSubtype {
    GovernanceProposals(GovernanceProposalsSubtype),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GovernanceProposalsSubtype {
    pub is_nns: bool,
    pub governance_canister_id: CanisterId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct Rules {
    pub text: String,
    pub enabled: bool,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, Default)]
pub struct VersionedRules {
    pub text: String,
    pub version: Version,
    pub enabled: bool,
}

impl VersionedRules {
    pub fn is_empty(&self) -> bool {
        self.text.is_empty() && self.version == Version::default() && !self.enabled
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct UpdatedRules {
    pub text: String,
    pub enabled: bool,
    pub new_version: bool,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct VideoCall {
    pub started: TimestampMillis,
    pub started_by: UserId,
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub call_type: VideoCallType,
    pub joined_by_current_user: bool,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Copy, Default, Eq, PartialEq)]
pub enum VideoCallType {
    Broadcast,
    #[default]
    Default,
}

#[ts_export]
#[expect(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ChatSummary {
    Group(ChatSummaryGroup),
    Direct(ChatSummaryDirect),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChatSummaryGroup {
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub is_public: bool,
    pub history_visible_to_new_joiners: bool,
    pub messages_visible_to_non_members: bool,
    pub permissions: GroupPermissions,
    pub rules: VersionedRules,
    pub events_ttl: Option<Milliseconds>,
    pub events_ttl_last_updated: Option<TimestampMillis>,
    pub gate_config: Option<AccessGateConfig>,
    pub video_call_in_progress: Option<VideoCall>,
    pub verified: Option<bool>,
    pub frozen: Option<FrozenGroupInfo>,
    pub date_last_pinned: Option<TimestampMillis>,
    pub last_updated: TimestampMillis,
    pub external_url: Option<String>,
    pub latest_event_index: EventIndex,
    pub latest_message_index: Option<MessageIndex>,
    pub member_count: u32,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChatSummaryDirect {
    pub last_updated: TimestampMillis,
    pub latest_event_index: EventIndex,
    pub latest_message_index: Option<MessageIndex>,
    pub events_ttl: Option<Milliseconds>,
    pub events_ttl_last_updated: Option<TimestampMillis>,
    pub video_call_in_progress: Option<VideoCall>,
}
