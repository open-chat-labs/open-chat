use crate::{
    AccessGate, AccessGateConfig, BotGroupDetails, BuildVersion, CanisterId, ChatId, EventIndex, EventWrapper, FrozenGroupInfo,
    GroupMember, GroupPermissions, GroupRole, HydratedMention, Message, MessageIndex, Milliseconds, OptionUpdate,
    TimestampMillis, UserId, Version,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

pub const MAX_THREADS_IN_SUMMARY: usize = 20;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DirectChatSummary {
    pub them: UserId,
    pub last_updated: TimestampMillis,
    #[ts(as = "crate::EventWrapperMessage")]
    pub latest_message: EventWrapper<Message>,
    pub latest_event_index: EventIndex,
    pub latest_message_index: MessageIndex,
    pub date_created: TimestampMillis,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub read_by_them_up_to: Option<MessageIndex>,
    pub notifications_muted: bool,
    pub metrics: ChatMetrics,
    pub my_metrics: ChatMetrics,
    pub archived: bool,
    pub events_ttl: Option<Milliseconds>,
    pub events_ttl_last_updated: TimestampMillis,
    pub video_call_in_progress: Option<VideoCall>,
}

impl DirectChatSummary {
    pub fn display_date(&self) -> TimestampMillis {
        self.latest_message.timestamp
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatSummary {
    pub chat_id: ChatId,
    pub local_user_index_canister_id: CanisterId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    pub subtype: Option<GroupSubtype>,
    pub avatar_id: Option<u128>,
    pub is_public: bool,
    pub history_visible_to_new_joiners: bool,
    pub messages_visible_to_non_members: bool,
    pub min_visible_event_index: EventIndex,
    pub min_visible_message_index: MessageIndex,
    #[ts(as = "Option<crate::EventWrapperMessage>")]
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub latest_message_index: Option<MessageIndex>,
    pub joined: TimestampMillis,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub notifications_muted: bool,
    pub participant_count: u32,
    pub role: GroupRole,
    pub mentions: Vec<HydratedMention>,
    pub wasm_version: BuildVersion,
    pub permissions_v2: GroupPermissions,
    pub metrics: ChatMetrics,
    pub my_metrics: ChatMetrics,
    pub latest_threads: Vec<ThreadSyncDetails>,
    pub archived: bool,
    pub frozen: Option<FrozenGroupInfo>,
    pub date_last_pinned: Option<TimestampMillis>,
    pub date_read_pinned: Option<TimestampMillis>,
    pub events_ttl: Option<Milliseconds>,
    pub events_ttl_last_updated: TimestampMillis,
    pub gate: Option<AccessGate>,
    pub gate_config: Option<AccessGateConfig>,
    pub rules_accepted: bool,
    pub video_call_in_progress: Option<VideoCall>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
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
    pub updated_events: Vec<(EventIndex, TimestampMillis)>,
    pub metrics: Option<ChatMetrics>,
    pub my_metrics: Option<ChatMetrics>,
    pub archived: Option<bool>,
    #[ts(as = "crate::OptionUpdateU64")]
    pub events_ttl: OptionUpdate<Milliseconds>,
    pub events_ttl_last_updated: Option<TimestampMillis>,
    #[ts(as = "crate::OptionUpdateVideoCall")]
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
    pub gate: Option<AccessGate>,
    pub gate_config: Option<AccessGateConfig>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupCanisterGroupChatSummary {
    pub chat_id: ChatId,
    pub local_user_index_canister_id: CanisterId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    pub subtype: Option<GroupSubtype>,
    pub avatar_id: Option<u128>,
    pub is_public: bool,
    pub history_visible_to_new_joiners: bool,
    pub messages_visible_to_non_members: bool,
    pub min_visible_event_index: EventIndex,
    pub min_visible_message_index: MessageIndex,
    #[ts(as = "Option<crate::EventWrapperMessage>")]
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub latest_message_index: Option<MessageIndex>,
    pub joined: TimestampMillis,
    pub participant_count: u32,
    pub role: GroupRole,
    pub mentions: Vec<HydratedMention>,
    pub wasm_version: BuildVersion,
    pub permissions_v2: GroupPermissions,
    pub notifications_muted: bool,
    pub metrics: ChatMetrics,
    pub my_metrics: ChatMetrics,
    pub latest_threads: Vec<GroupCanisterThreadDetails>,
    pub frozen: Option<FrozenGroupInfo>,
    pub date_last_pinned: Option<TimestampMillis>,
    pub events_ttl: Option<Milliseconds>,
    pub events_ttl_last_updated: TimestampMillis,
    pub gate: Option<AccessGate>,
    pub gate_config: Option<AccessGateConfig>,
    pub rules_accepted: bool,
    pub membership: Option<GroupMembership>,
    pub video_call_in_progress: Option<VideoCall>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupCanisterGroupChatSummaryUpdates {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub name: Option<String>,
    pub description: Option<String>,
    #[ts(as = "crate::OptionUpdateGroupSubtype")]
    pub subtype: OptionUpdate<GroupSubtype>,
    #[ts(as = "crate::OptionUpdateU128")]
    pub avatar_id: OptionUpdate<u128>,
    #[ts(as = "Option<crate::EventWrapperMessage>")]
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: Option<EventIndex>,
    pub latest_message_index: Option<MessageIndex>,
    pub participant_count: Option<u32>,
    pub role: Option<GroupRole>,
    pub mentions: Vec<HydratedMention>,
    pub wasm_version: Option<BuildVersion>,
    pub permissions_v2: Option<GroupPermissions>,
    pub updated_events: Vec<(Option<MessageIndex>, EventIndex, TimestampMillis)>, // (Thread root message index, event index, timestamp)
    pub metrics: Option<ChatMetrics>,
    pub my_metrics: Option<ChatMetrics>,
    pub is_public: Option<bool>,
    pub messages_visible_to_non_members: Option<bool>,
    pub latest_threads: Vec<GroupCanisterThreadDetails>,
    pub unfollowed_threads: Vec<MessageIndex>,
    pub notifications_muted: Option<bool>,
    #[ts(as = "crate::OptionUpdateFrozenGroupInfo")]
    pub frozen: OptionUpdate<FrozenGroupInfo>,
    pub date_last_pinned: Option<TimestampMillis>,
    #[ts(as = "crate::OptionUpdateU64")]
    pub events_ttl: OptionUpdate<Milliseconds>,
    pub events_ttl_last_updated: Option<TimestampMillis>,
    #[ts(as = "crate::OptionUpdateAccessGate")]
    pub gate: OptionUpdate<AccessGate>,
    #[ts(as = "crate::OptionUpdateAccessGateConfig")]
    pub gate_config: OptionUpdate<AccessGateConfig>,
    pub rules_accepted: Option<bool>,
    pub membership: Option<GroupMembershipUpdates>,
    #[ts(as = "crate::OptionUpdateVideoCall")]
    pub video_call_in_progress: OptionUpdate<VideoCall>,
    pub any_updates_missed: bool,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupMembership {
    pub joined: TimestampMillis,
    pub role: GroupRole,
    pub mentions: Vec<HydratedMention>,
    pub notifications_muted: bool,
    pub my_metrics: ChatMetrics,
    pub latest_threads: Vec<GroupCanisterThreadDetails>,
    pub rules_accepted: bool,
    pub lapsed: bool,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupMembershipUpdates {
    pub role: Option<GroupRole>,
    pub mentions: Vec<HydratedMention>,
    pub notifications_muted: Option<bool>,
    pub my_metrics: Option<ChatMetrics>,
    pub latest_threads: Vec<GroupCanisterThreadDetails>,
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
    pub members_added_or_updated: Vec<GroupMember>,
    pub members_removed: Vec<UserId>,
    pub bots_added_or_updated: Vec<BotGroupDetails>,
    pub bots_removed: Vec<UserId>,
    pub blocked_users_added: Vec<UserId>,
    pub blocked_users_removed: Vec<UserId>,
    pub invited_users: Option<Vec<UserId>>,
    pub pinned_messages_added: Vec<MessageIndex>,
    pub pinned_messages_removed: Vec<MessageIndex>,
    pub chat_rules: Option<VersionedRules>,
}

impl SelectedGroupUpdates {
    pub fn has_updates(&self) -> bool {
        !self.members_added_or_updated.is_empty()
            || !self.members_removed.is_empty()
            || !self.bots_added_or_updated.is_empty()
            || !self.bots_removed.is_empty()
            || !self.blocked_users_added.is_empty()
            || !self.blocked_users_removed.is_empty()
            || self.invited_users.is_some()
            || !self.pinned_messages_added.is_empty()
            || !self.pinned_messages_removed.is_empty()
            || self.chat_rules.is_some()
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Default, Clone)]
pub struct ChatMetrics {
    pub text_messages: u64,
    pub image_messages: u64,
    pub video_messages: u64,
    pub audio_messages: u64,
    pub file_messages: u64,
    pub polls: u64,
    pub poll_votes: u64,
    pub crypto_messages: u64,
    pub icp_messages: u64,
    pub sns1_messages: u64,
    pub ckbtc_messages: u64,
    pub chat_messages: u64,
    pub kinic_messages: u64,
    pub deleted_messages: u64,
    pub giphy_messages: u64,
    pub prize_messages: u64,
    pub prize_winner_messages: u64,
    pub replies: u64,
    pub edits: u64,
    pub reactions: u64,
    pub proposals: u64,
    pub reported_messages: u64,
    pub message_reminders: u64,
    pub custom_type_messages: u64,
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
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct VersionedRules {
    pub text: String,
    pub version: Version,
    pub enabled: bool,
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
    pub message_index: MessageIndex,
    pub call_type: VideoCallType,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Copy, Default, Eq, PartialEq)]
pub enum VideoCallType {
    Broadcast,
    #[default]
    Default,
}
