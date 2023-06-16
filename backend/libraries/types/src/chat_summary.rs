use crate::{
    AccessGate, CanisterId, ChatId, EventIndex, EventWrapper, FrozenGroupInfo, GroupMember, GroupPermissions, GroupRole,
    HydratedMention, Message, MessageIndex, Milliseconds, OptionUpdate, RangeSet, TimestampMillis, UserId, Version,
    MAX_RETURNED_MENTIONS,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

pub const MAX_THREADS_IN_SUMMARY: usize = 20;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DirectChatSummary {
    pub them: UserId,
    pub latest_message: EventWrapper<Message>,
    pub latest_event_index: EventIndex,
    pub date_created: TimestampMillis,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub read_by_them_up_to: Option<MessageIndex>,
    pub notifications_muted: bool,
    pub metrics: ChatMetrics,
    pub my_metrics: ChatMetrics,
    pub archived: bool,
    pub events_ttl: Option<Milliseconds>,
    pub expired_messages: RangeSet<MessageIndex>,
}

impl DirectChatSummary {
    pub fn display_date(&self) -> TimestampMillis {
        self.latest_message.timestamp
    }
}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatSummary {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    pub subtype: Option<GroupSubtype>,
    pub avatar_id: Option<u128>,
    pub is_public: bool,
    pub history_visible_to_new_joiners: bool,
    pub min_visible_event_index: EventIndex,
    pub min_visible_message_index: MessageIndex,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub joined: TimestampMillis,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub notifications_muted: bool,
    pub participant_count: u32,
    pub role: GroupRole,
    pub mentions: Vec<HydratedMention>,
    pub wasm_version: Version,
    pub permissions: GroupPermissions,
    pub metrics: ChatMetrics,
    pub my_metrics: ChatMetrics,
    pub latest_threads: Vec<ThreadSyncDetails>,
    pub archived: bool,
    pub frozen: Option<FrozenGroupInfo>,
    pub date_last_pinned: Option<TimestampMillis>,
    pub date_read_pinned: Option<TimestampMillis>,
    pub events_ttl: Option<Milliseconds>,
    pub expired_messages: RangeSet<MessageIndex>,
    pub next_message_expiry: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DirectChatSummaryUpdates {
    pub chat_id: ChatId,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: Option<EventIndex>,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub read_by_them_up_to: Option<MessageIndex>,
    pub notifications_muted: Option<bool>,
    pub updated_events: Vec<(EventIndex, TimestampMillis)>,
    pub metrics: Option<ChatMetrics>,
    pub my_metrics: Option<ChatMetrics>,
    pub archived: Option<bool>,
    pub events_ttl: OptionUpdate<Milliseconds>,
    pub newly_expired_messages: RangeSet<MessageIndex>,
}

// TODO: This type is used in the response from group::public_summary and group_index::recommended_groups
// which is causing unnecessarily coupling. We should use separate types for these use cases.
// For instance we only need to return history_visible_to_new_joiners and is_public from group::public_summary
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PublicGroupSummary {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    pub subtype: Option<GroupSubtype>,
    #[serde(default)]
    pub history_visible_to_new_joiners: bool,
    pub avatar_id: Option<u128>,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub participant_count: u32,
    pub wasm_version: Version,
    pub is_public: bool,
    pub frozen: Option<FrozenGroupInfo>,
    pub events_ttl: Option<Milliseconds>,
    pub gate: Option<AccessGate>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupCanisterGroupChatSummary {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    pub subtype: Option<GroupSubtype>,
    pub avatar_id: Option<u128>,
    pub is_public: bool,
    pub history_visible_to_new_joiners: bool,
    pub min_visible_event_index: EventIndex,
    pub min_visible_message_index: MessageIndex,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub joined: TimestampMillis,
    pub participant_count: u32,
    pub role: GroupRole,
    pub mentions: Vec<HydratedMention>,
    pub wasm_version: Version,
    pub permissions: GroupPermissions,
    pub notifications_muted: bool,
    pub metrics: ChatMetrics,
    pub my_metrics: ChatMetrics,
    pub latest_threads: Vec<GroupCanisterThreadDetails>,
    pub frozen: Option<FrozenGroupInfo>,
    pub date_last_pinned: Option<TimestampMillis>,
    pub events_ttl: Option<Milliseconds>,
    pub expired_messages: RangeSet<MessageIndex>,
    pub next_message_expiry: Option<TimestampMillis>,
    pub gate: Option<AccessGate>,
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

        GroupCanisterGroupChatSummary {
            chat_id: self.chat_id,
            last_updated: updates.last_updated,
            name: updates.name.unwrap_or(self.name),
            description: updates.description.unwrap_or(self.description),
            subtype: updates.subtype.apply_to(self.subtype),
            avatar_id: updates.avatar_id.apply_to(self.avatar_id),
            is_public: updates.is_public.unwrap_or(self.is_public),
            history_visible_to_new_joiners: self.history_visible_to_new_joiners,
            min_visible_event_index: self.min_visible_event_index,
            min_visible_message_index: self.min_visible_message_index,
            latest_message: updates.latest_message.or(self.latest_message),
            latest_event_index: updates.latest_event_index.unwrap_or(self.latest_event_index),
            joined: self.joined,
            participant_count: updates.participant_count.unwrap_or(self.participant_count),
            role: updates.role.unwrap_or(self.role),
            mentions,
            wasm_version: updates.wasm_version.unwrap_or(self.wasm_version),
            permissions: updates.permissions.unwrap_or(self.permissions),
            notifications_muted: updates.notifications_muted.unwrap_or(self.notifications_muted),
            metrics: updates.metrics.unwrap_or(self.metrics),
            my_metrics: updates.my_metrics.unwrap_or(self.my_metrics),
            latest_threads,
            frozen: updates.frozen.apply_to(self.frozen),
            date_last_pinned: updates.date_last_pinned.or(self.date_last_pinned),
            events_ttl: updates.events_ttl.apply_to(self.events_ttl),
            expired_messages: self.expired_messages.merge(updates.newly_expired_messages),
            next_message_expiry: updates.next_message_expiry.apply_to(self.next_message_expiry),
            gate: updates.gate.apply_to(self.gate),
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupCanisterGroupChatSummaryUpdates {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub name: Option<String>,
    pub description: Option<String>,
    pub subtype: OptionUpdate<GroupSubtype>,
    pub avatar_id: OptionUpdate<u128>,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: Option<EventIndex>,
    pub participant_count: Option<u32>,
    pub role: Option<GroupRole>,
    pub mentions: Vec<HydratedMention>,
    pub wasm_version: Option<Version>,
    pub permissions: Option<GroupPermissions>,
    pub updated_events: Vec<(Option<MessageIndex>, EventIndex, TimestampMillis)>, // (Thread root message index, event index, timestamp)
    pub metrics: Option<ChatMetrics>,
    pub my_metrics: Option<ChatMetrics>,
    pub is_public: Option<bool>,
    pub latest_threads: Vec<GroupCanisterThreadDetails>,
    pub notifications_muted: Option<bool>,
    pub frozen: OptionUpdate<FrozenGroupInfo>,
    pub date_last_pinned: Option<TimestampMillis>,
    pub events_ttl: OptionUpdate<Milliseconds>,
    pub newly_expired_messages: RangeSet<MessageIndex>,
    pub next_message_expiry: OptionUpdate<TimestampMillis>,
    pub gate: OptionUpdate<AccessGate>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
pub struct SelectedGroupUpdates {
    pub timestamp: TimestampMillis,
    pub latest_event_index: EventIndex,
    pub members_added_or_updated: Vec<GroupMember>,
    pub members_removed: Vec<UserId>,
    pub blocked_users_added: Vec<UserId>,
    pub blocked_users_removed: Vec<UserId>,
    pub invited_users: Option<Vec<UserId>>,
    pub pinned_messages_added: Vec<MessageIndex>,
    pub pinned_messages_removed: Vec<MessageIndex>,
    pub rules: Option<AccessRules>,
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
            || self.rules.is_some()
    }
}

#[derive(CandidType, Serialize, Deserialize, Debug, Default, Clone)]
pub struct ChatMetrics {
    pub text_messages: u64,
    pub image_messages: u64,
    pub video_messages: u64,
    pub audio_messages: u64,
    pub file_messages: u64,
    pub polls: u64,
    pub poll_votes: u64,
    #[serde(default)]
    pub cycles_messages: u64,
    pub icp_messages: u64,
    pub sns1_messages: u64,
    pub ckbtc_messages: u64,
    pub chat_messages: u64,
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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ThreadSyncDetails {
    pub root_message_index: MessageIndex,
    pub latest_event: Option<EventIndex>,
    pub latest_message: Option<MessageIndex>,
    pub read_up_to: Option<MessageIndex>,
    pub last_updated: TimestampMillis,
}

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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum GroupSubtype {
    GovernanceProposals(GovernanceProposalsSubtype),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GovernanceProposalsSubtype {
    pub is_nns: bool,
    pub governance_canister_id: CanisterId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct AccessRules {
    pub text: String,
    pub enabled: bool,
}
