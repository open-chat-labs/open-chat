use crate::{
    AccessGate, BuildVersion, CanisterId, ChatId, EventIndex, EventWrapper, FrozenGroupInfo, GroupMember, GroupPermissions,
    GroupRole, HydratedMention, Message, MessageIndex, Milliseconds, OptionUpdate, TimestampMillis, UserId, Version,
    MAX_RETURNED_MENTIONS,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use ts_rs::TS;

pub const MAX_THREADS_IN_SUMMARY: usize = 20;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub struct DirectChatSummary {
    pub them: UserId,
    pub last_updated: TimestampMillis,
    #[ts(as = "crate::EventWrapperMessage")]
    pub latest_message: EventWrapper<Message>,
    pub latest_event_index: EventIndex,
    pub latest_message_index: MessageIndex,
    pub date_created: TimestampMillis,
    #[ts(optional)]
    pub read_by_me_up_to: Option<MessageIndex>,
    #[ts(optional)]
    pub read_by_them_up_to: Option<MessageIndex>,
    pub notifications_muted: bool,
    pub metrics: ChatMetrics,
    pub my_metrics: ChatMetrics,
    pub archived: bool,
    #[ts(optional)]
    pub events_ttl: Option<Milliseconds>,
    pub events_ttl_last_updated: TimestampMillis,
    #[ts(optional)]
    pub video_call_in_progress: Option<VideoCall>,
}

impl DirectChatSummary {
    pub fn display_date(&self) -> TimestampMillis {
        self.latest_message.timestamp
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub struct GroupChatSummary {
    pub chat_id: ChatId,
    pub local_user_index_canister_id: CanisterId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    #[ts(optional)]
    pub subtype: Option<GroupSubtype>,
    #[ts(optional)]
    pub avatar_id: Option<u128>,
    pub is_public: bool,
    pub history_visible_to_new_joiners: bool,
    pub messages_visible_to_non_members: bool,
    pub min_visible_event_index: EventIndex,
    pub min_visible_message_index: MessageIndex,
    #[ts(as = "Option<crate::EventWrapperMessage>", optional)]
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    #[ts(optional)]
    pub latest_message_index: Option<MessageIndex>,
    pub joined: TimestampMillis,
    #[ts(optional)]
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
    #[ts(optional)]
    pub frozen: Option<FrozenGroupInfo>,
    #[ts(optional)]
    pub date_last_pinned: Option<TimestampMillis>,
    #[ts(optional)]
    pub date_read_pinned: Option<TimestampMillis>,
    #[ts(optional)]
    pub events_ttl: Option<Milliseconds>,
    pub events_ttl_last_updated: TimestampMillis,
    #[ts(optional)]
    pub gate: Option<AccessGate>,
    pub rules_accepted: bool,
    #[ts(optional)]
    pub video_call_in_progress: Option<VideoCall>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub struct DirectChatSummaryUpdates {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    #[ts(as = "Option<crate::EventWrapperMessage>", optional)]
    pub latest_message: Option<EventWrapper<Message>>,
    #[ts(optional)]
    pub latest_event_index: Option<EventIndex>,
    #[ts(optional)]
    pub latest_message_index: Option<MessageIndex>,
    #[ts(optional)]
    pub read_by_me_up_to: Option<MessageIndex>,
    #[ts(optional)]
    pub read_by_them_up_to: Option<MessageIndex>,
    #[ts(optional)]
    pub notifications_muted: Option<bool>,
    pub updated_events: Vec<(EventIndex, TimestampMillis)>,
    #[ts(optional)]
    pub metrics: Option<ChatMetrics>,
    #[ts(optional)]
    pub my_metrics: Option<ChatMetrics>,
    #[ts(optional)]
    pub archived: Option<bool>,
    pub events_ttl: OptionUpdate<Milliseconds>,
    #[ts(optional)]
    pub events_ttl_last_updated: Option<TimestampMillis>,
    pub video_call_in_progress: OptionUpdate<VideoCall>,
}

// TODO: This type is used in the response from group::public_summary and group_index::recommended_groups
// which is causing unnecessarily coupling. We should use separate types for these use cases.
// For instance we only need to return history_visible_to_new_joiners and is_public from group::public_summary
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub struct PublicGroupSummary {
    pub chat_id: ChatId,
    pub local_user_index_canister_id: CanisterId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    #[ts(optional)]
    pub subtype: Option<GroupSubtype>,
    pub history_visible_to_new_joiners: bool,
    pub messages_visible_to_non_members: bool,
    #[ts(optional)]
    pub avatar_id: Option<u128>,
    #[ts(as = "Option<crate::EventWrapperMessage>", optional)]
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    #[ts(optional)]
    pub latest_message_index: Option<MessageIndex>,
    pub participant_count: u32,
    pub wasm_version: BuildVersion,
    pub is_public: bool,
    #[ts(optional)]
    pub frozen: Option<FrozenGroupInfo>,
    #[ts(optional)]
    pub events_ttl: Option<Milliseconds>,
    pub events_ttl_last_updated: TimestampMillis,
    #[ts(optional)]
    pub gate: Option<AccessGate>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub struct GroupCanisterGroupChatSummary {
    pub chat_id: ChatId,
    pub local_user_index_canister_id: CanisterId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    #[ts(optional)]
    pub subtype: Option<GroupSubtype>,
    #[ts(optional)]
    pub avatar_id: Option<u128>,
    pub is_public: bool,
    pub history_visible_to_new_joiners: bool,
    pub messages_visible_to_non_members: bool,
    pub min_visible_event_index: EventIndex,
    pub min_visible_message_index: MessageIndex,
    #[ts(as = "Option<crate::EventWrapperMessage>", optional)]
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    #[ts(optional)]
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
    #[ts(optional)]
    pub frozen: Option<FrozenGroupInfo>,
    #[ts(optional)]
    pub date_last_pinned: Option<TimestampMillis>,
    #[ts(optional)]
    pub events_ttl: Option<Milliseconds>,
    pub events_ttl_last_updated: TimestampMillis,
    #[ts(optional)]
    pub gate: Option<AccessGate>,
    pub rules_accepted: bool,
    #[ts(optional)]
    pub membership: Option<GroupMembership>,
    #[ts(optional)]
    pub video_call_in_progress: Option<VideoCall>,
}

impl GroupCanisterGroupChatSummary {
    pub fn merge(self, updates: GroupCanisterGroupChatSummaryUpdates) -> Self {
        if self.chat_id != updates.chat_id {
            panic!(
                "Updates are not from the same chat. Original: {}. Updates: {}",
                self.chat_id, updates.chat_id
            );
        }

        // Mentions are ordered in ascending order of MessageIndex
        let mentions_to_skip = (self.mentions.len() + updates.mentions.len()).saturating_sub(MAX_RETURNED_MENTIONS);
        let mentions: Vec<_> = self
            .mentions
            .into_iter()
            .chain(updates.mentions)
            .skip(mentions_to_skip)
            .collect();

        let mut threads_set = HashSet::new();
        // Threads are ordered in descending chronological order
        let latest_threads = updates
            .latest_threads
            .into_iter()
            .chain(self.latest_threads)
            // We could use Itertools `unique_by` but I didn't want to add that dependency
            .filter(|t| threads_set.insert(t.root_message_index))
            .take(MAX_THREADS_IN_SUMMARY)
            .collect();

        let membership = GroupMembership {
            joined: self.joined,
            role: updates.role.unwrap_or(self.role),
            mentions,
            notifications_muted: updates.notifications_muted.unwrap_or(self.notifications_muted),
            my_metrics: updates.my_metrics.unwrap_or(self.my_metrics),
            latest_threads,
            rules_accepted: updates.rules_accepted.unwrap_or(self.rules_accepted),
        };

        GroupCanisterGroupChatSummary {
            chat_id: self.chat_id,
            local_user_index_canister_id: self.local_user_index_canister_id,
            last_updated: updates.last_updated,
            name: updates.name.unwrap_or(self.name),
            description: updates.description.unwrap_or(self.description),
            subtype: updates.subtype.apply_to(self.subtype),
            avatar_id: updates.avatar_id.apply_to(self.avatar_id),
            is_public: updates.is_public.unwrap_or(self.is_public),
            history_visible_to_new_joiners: self.history_visible_to_new_joiners,
            messages_visible_to_non_members: updates
                .messages_visible_to_non_members
                .unwrap_or(self.messages_visible_to_non_members),
            min_visible_event_index: self.min_visible_event_index,
            min_visible_message_index: self.min_visible_message_index,
            latest_message: updates.latest_message.or(self.latest_message),
            latest_event_index: updates.latest_event_index.unwrap_or(self.latest_event_index),
            latest_message_index: updates.latest_message_index,
            joined: self.joined,
            participant_count: updates.participant_count.unwrap_or(self.participant_count),
            role: updates.role.unwrap_or(self.role),
            mentions: membership.mentions.clone(),
            wasm_version: updates.wasm_version.unwrap_or(self.wasm_version),
            permissions_v2: updates.permissions_v2.unwrap_or(self.permissions_v2),
            notifications_muted: membership.notifications_muted,
            metrics: updates.metrics.unwrap_or(self.metrics),
            my_metrics: membership.my_metrics.clone(),
            latest_threads: membership.latest_threads.clone(),
            frozen: updates.frozen.apply_to(self.frozen),
            date_last_pinned: updates.date_last_pinned.or(self.date_last_pinned),
            events_ttl: updates.events_ttl.apply_to(self.events_ttl),
            events_ttl_last_updated: updates.events_ttl_last_updated.unwrap_or(self.events_ttl_last_updated),
            gate: updates.gate.apply_to(self.gate),
            rules_accepted: membership.rules_accepted,
            membership: Some(membership),
            video_call_in_progress: updates.video_call_in_progress.apply_to(self.video_call_in_progress),
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub struct GroupCanisterGroupChatSummaryUpdates {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    #[ts(optional)]
    pub name: Option<String>,
    #[ts(optional)]
    pub description: Option<String>,
    pub subtype: OptionUpdate<GroupSubtype>,
    pub avatar_id: OptionUpdate<u128>,
    #[ts(as = "Option<crate::EventWrapperMessage>", optional)]
    pub latest_message: Option<EventWrapper<Message>>,
    #[ts(optional)]
    pub latest_event_index: Option<EventIndex>,
    #[ts(optional)]
    pub latest_message_index: Option<MessageIndex>,
    #[ts(optional)]
    pub participant_count: Option<u32>,
    #[ts(optional)]
    pub role: Option<GroupRole>,
    pub mentions: Vec<HydratedMention>,
    #[ts(optional)]
    pub wasm_version: Option<BuildVersion>,
    #[ts(optional)]
    pub permissions_v2: Option<GroupPermissions>,
    pub updated_events: Vec<(Option<MessageIndex>, EventIndex, TimestampMillis)>, // (Thread root message index, event index, timestamp)
    #[ts(optional)]
    pub metrics: Option<ChatMetrics>,
    #[ts(optional)]
    pub my_metrics: Option<ChatMetrics>,
    #[ts(optional)]
    pub is_public: Option<bool>,
    #[ts(optional)]
    pub messages_visible_to_non_members: Option<bool>,
    pub latest_threads: Vec<GroupCanisterThreadDetails>,
    pub unfollowed_threads: Vec<MessageIndex>,
    #[ts(optional)]
    pub notifications_muted: Option<bool>,
    pub frozen: OptionUpdate<FrozenGroupInfo>,
    #[ts(optional)]
    pub date_last_pinned: Option<TimestampMillis>,
    pub events_ttl: OptionUpdate<Milliseconds>,
    #[ts(optional)]
    pub events_ttl_last_updated: Option<TimestampMillis>,
    pub gate: OptionUpdate<AccessGate>,
    #[ts(optional)]
    pub rules_accepted: Option<bool>,
    #[ts(optional)]
    pub membership: Option<GroupMembershipUpdates>,
    pub video_call_in_progress: OptionUpdate<VideoCall>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub struct GroupMembership {
    pub joined: TimestampMillis,
    pub role: GroupRole,
    pub mentions: Vec<HydratedMention>,
    pub notifications_muted: bool,
    pub my_metrics: ChatMetrics,
    pub latest_threads: Vec<GroupCanisterThreadDetails>,
    pub rules_accepted: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub struct GroupMembershipUpdates {
    #[ts(optional)]
    pub role: Option<GroupRole>,
    pub mentions: Vec<HydratedMention>,
    #[ts(optional)]
    pub notifications_muted: Option<bool>,
    #[ts(optional)]
    pub my_metrics: Option<ChatMetrics>,
    pub latest_threads: Vec<GroupCanisterThreadDetails>,
    pub unfollowed_threads: Vec<MessageIndex>,
    #[ts(optional)]
    pub rules_accepted: Option<bool>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Default, TS)]
pub struct SelectedGroupUpdates {
    pub timestamp: TimestampMillis,
    pub last_updated: TimestampMillis,
    pub latest_event_index: EventIndex,
    pub members_added_or_updated: Vec<GroupMember>,
    pub members_removed: Vec<UserId>,
    pub blocked_users_added: Vec<UserId>,
    pub blocked_users_removed: Vec<UserId>,
    #[ts(optional)]
    pub invited_users: Option<Vec<UserId>>,
    pub pinned_messages_added: Vec<MessageIndex>,
    pub pinned_messages_removed: Vec<MessageIndex>,
    #[ts(optional)]
    pub chat_rules: Option<VersionedRules>,
}

impl SelectedGroupUpdates {
    pub fn has_updates(&self) -> bool {
        !self.members_added_or_updated.is_empty()
            || !self.members_removed.is_empty()
            || !self.blocked_users_added.is_empty()
            || !self.blocked_users_removed.is_empty()
            || self.invited_users.is_some()
            || !self.pinned_messages_added.is_empty()
            || !self.pinned_messages_removed.is_empty()
            || self.chat_rules.is_some()
    }
}

#[derive(CandidType, Serialize, Deserialize, Debug, Default, Clone, TS)]
pub struct ChatMetrics {
    pub text_messages: u64,
    pub image_messages: u64,
    pub video_messages: u64,
    pub audio_messages: u64,
    pub file_messages: u64,
    pub polls: u64,
    pub poll_votes: u64,
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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub struct ThreadSyncDetails {
    pub root_message_index: MessageIndex,
    #[ts(optional)]
    pub latest_event: Option<EventIndex>,
    #[ts(optional)]
    pub latest_message: Option<MessageIndex>,
    #[ts(optional)]
    pub read_up_to: Option<MessageIndex>,
    pub last_updated: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub enum GroupSubtype {
    GovernanceProposals(GovernanceProposalsSubtype),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub struct GovernanceProposalsSubtype {
    pub is_nns: bool,
    pub governance_canister_id: CanisterId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, TS)]
pub struct Rules {
    pub text: String,
    pub enabled: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct VersionedRules {
    pub text: String,
    pub version: Version,
    pub enabled: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, TS)]
pub struct UpdatedRules {
    pub text: String,
    pub enabled: bool,
    pub new_version: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub struct VideoCall {
    pub message_index: MessageIndex,
    pub call_type: VideoCallType,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Copy, Default, Eq, PartialEq, TS)]
pub enum VideoCallType {
    Broadcast,
    #[default]
    Default,
}
