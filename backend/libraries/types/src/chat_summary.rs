use crate::{
    CanisterId, ChatId, EventIndex, EventWrapper, GroupPermissions, Mention, Message, MessageIndex, MessageIndexRange,
    OptionUpdate, Role, TimestampMillis, UserId, Version, MAX_RETURNED_MENTIONS,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::cmp::max;
use std::collections::HashSet;

pub const MAX_THREADS_IN_SUMMARY: usize = 20;

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ChatSummary {
    Direct(DirectChatSummary),
    Group(GroupChatSummary),
}

impl ChatSummary {
    pub fn display_date(&self) -> TimestampMillis {
        match self {
            ChatSummary::Direct(d) => d.display_date(),
            ChatSummary::Group(g) => g.display_date(),
        }
    }

    pub fn chat_id(&self) -> ChatId {
        match self {
            ChatSummary::Direct(d) => d.them.into(),
            ChatSummary::Group(g) => g.chat_id,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DirectChatSummary {
    pub them: UserId,
    pub latest_message: EventWrapper<Message>,
    pub latest_event_index: EventIndex,
    pub date_created: TimestampMillis,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub read_by_them_up_to: Option<MessageIndex>,
    pub read_by_me: Vec<MessageIndexRange>,
    pub read_by_them: Vec<MessageIndexRange>,
    pub notifications_muted: bool,
    pub metrics: ChatMetrics,
    pub my_metrics: ChatMetrics,
    pub archived: bool,
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
    pub read_by_me: Vec<MessageIndexRange>,
    pub notifications_muted: bool,
    pub participant_count: u32,
    pub role: Role,
    pub mentions: Vec<Mention>,
    pub wasm_version: Version,
    pub owner_id: UserId,
    pub permissions: GroupPermissions,
    pub metrics: ChatMetrics,
    pub my_metrics: ChatMetrics,
    pub latest_threads: Vec<ThreadSyncDetails>,
    pub archived: bool,
}

impl GroupChatSummary {
    pub fn display_date(&self) -> TimestampMillis {
        self.latest_message.as_ref().map_or(self.joined, |m| m.timestamp)
    }
}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ChatSummaryUpdates {
    Direct(DirectChatSummaryUpdates),
    Group(GroupChatSummaryUpdates),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DirectChatSummaryUpdates {
    pub chat_id: ChatId,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: Option<EventIndex>,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub read_by_them_up_to: Option<MessageIndex>,
    pub read_by_me: Option<Vec<MessageIndexRange>>,
    pub read_by_them: Option<Vec<MessageIndexRange>>,
    pub notifications_muted: Option<bool>,
    pub affected_events: Vec<EventIndex>,
    pub metrics: Option<ChatMetrics>,
    pub my_metrics: Option<ChatMetrics>,
    pub archived: Option<bool>,
}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatSummaryUpdates {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub name: Option<String>,
    pub description: Option<String>,
    pub subtype: OptionUpdate<GroupSubtype>,
    pub avatar_id: OptionUpdate<u128>,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: Option<EventIndex>,
    pub read_by_me_up_to: Option<MessageIndex>,
    pub read_by_me: Option<Vec<MessageIndexRange>>,
    pub notifications_muted: Option<bool>,
    pub participant_count: Option<u32>,
    pub role: Option<Role>,
    pub mentions: Vec<Mention>,
    pub wasm_version: Option<Version>,
    pub owner_id: Option<UserId>,
    pub permissions: Option<GroupPermissions>,
    pub affected_events: Vec<EventIndex>,
    pub metrics: Option<ChatMetrics>,
    pub my_metrics: Option<ChatMetrics>,
    pub is_public: Option<bool>,
    pub latest_threads: Vec<ThreadSyncDetails>,
    pub archived: Option<bool>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PublicGroupSummary {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    pub subtype: Option<GroupSubtype>,
    pub avatar_id: Option<u128>,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub participant_count: u32,
    pub wasm_version: Version,
    pub owner_id: UserId,
    pub is_public: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatSummaryInternal {
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
    pub role: Role,
    pub mentions: Vec<Mention>,
    pub wasm_version: Version,
    pub owner_id: UserId,
    pub permissions: GroupPermissions,
    pub notifications_muted: bool,
    pub metrics: ChatMetrics,
    pub my_metrics: ChatMetrics,
    pub latest_threads: Vec<ThreadSyncDetailsInternal>,
}

impl GroupChatSummaryInternal {
    pub fn merge(self, updates: GroupChatSummaryUpdatesInternal) -> Self {
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

        GroupChatSummaryInternal {
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
            owner_id: updates.owner_id.unwrap_or(self.owner_id),
            permissions: updates.permissions.unwrap_or(self.permissions),
            notifications_muted: updates.notifications_muted.unwrap_or(self.notifications_muted),
            metrics: updates.metrics.unwrap_or(self.metrics),
            my_metrics: updates.my_metrics.unwrap_or(self.my_metrics),
            latest_threads,
        }
    }
}

impl From<GroupChatSummaryInternal> for GroupChatSummary {
    fn from(s: GroupChatSummaryInternal) -> Self {
        GroupChatSummary {
            chat_id: s.chat_id,
            last_updated: s.last_updated,
            name: s.name,
            description: s.description,
            subtype: s.subtype,
            avatar_id: s.avatar_id,
            is_public: s.is_public,
            history_visible_to_new_joiners: s.history_visible_to_new_joiners,
            min_visible_event_index: s.min_visible_event_index,
            min_visible_message_index: s.min_visible_message_index,
            latest_message: s.latest_message,
            latest_event_index: s.latest_event_index,
            joined: s.joined,
            read_by_me_up_to: None,
            read_by_me: vec![],
            notifications_muted: s.notifications_muted,
            participant_count: s.participant_count,
            role: s.role,
            mentions: s.mentions,
            wasm_version: s.wasm_version,
            owner_id: s.owner_id,
            permissions: s.permissions,
            metrics: s.metrics,
            my_metrics: s.my_metrics,
            latest_threads: s.latest_threads.into_iter().map(|t| t.into()).collect(),
            archived: false,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatSummaryUpdatesInternal {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub name: Option<String>,
    pub description: Option<String>,
    pub subtype: OptionUpdate<GroupSubtype>,
    pub avatar_id: OptionUpdate<u128>,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: Option<EventIndex>,
    pub participant_count: Option<u32>,
    pub role: Option<Role>,
    pub mentions: Vec<Mention>,
    pub wasm_version: Option<Version>,
    pub owner_id: Option<UserId>,
    pub permissions: Option<GroupPermissions>,
    pub affected_events: Vec<EventIndex>,
    pub affected_events_v2: Vec<(EventIndex, TimestampMillis)>,
    pub metrics: Option<ChatMetrics>,
    pub my_metrics: Option<ChatMetrics>,
    pub is_public: Option<bool>,
    pub latest_threads: Vec<ThreadSyncDetailsInternal>,
    pub notifications_muted: Option<bool>,
}

impl From<GroupChatSummaryUpdatesInternal> for GroupChatSummaryUpdates {
    fn from(s: GroupChatSummaryUpdatesInternal) -> Self {
        GroupChatSummaryUpdates {
            chat_id: s.chat_id,
            last_updated: s.last_updated,
            name: s.name,
            description: s.description,
            subtype: s.subtype,
            avatar_id: s.avatar_id,
            latest_message: s.latest_message,
            latest_event_index: s.latest_event_index,
            participant_count: s.participant_count,
            role: s.role,
            read_by_me_up_to: None,
            read_by_me: None,
            notifications_muted: s.notifications_muted,
            mentions: s.mentions,
            wasm_version: s.wasm_version,
            owner_id: s.owner_id,
            permissions: s.permissions,
            affected_events: s.affected_events,
            metrics: s.metrics,
            my_metrics: s.my_metrics,
            is_public: s.is_public,
            latest_threads: s.latest_threads.into_iter().map(|t| t.into()).collect(),
            archived: None,
        }
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
    pub cycles_messages: u64,
    pub icp_messages: u64,
    pub deleted_messages: u64,
    pub giphy_messages: u64,
    pub replies: u64,
    pub edits: u64,
    pub reactions: u64,
    pub proposals: u64,
    pub last_active: TimestampMillis,
}

impl ChatMetrics {
    pub fn merge(&mut self, other: &ChatMetrics) {
        self.text_messages += other.text_messages;
        self.image_messages += other.image_messages;
        self.video_messages += other.video_messages;
        self.audio_messages += other.audio_messages;
        self.file_messages += other.file_messages;
        self.polls += other.polls;
        self.poll_votes += other.poll_votes;
        self.cycles_messages += other.cycles_messages;
        self.icp_messages += other.icp_messages;
        self.deleted_messages += other.deleted_messages;
        self.giphy_messages += other.giphy_messages;
        self.replies += other.replies;
        self.edits += other.edits;
        self.reactions += other.reactions;
        self.proposals += other.proposals;
        self.last_active = max(self.last_active, other.last_active);
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ThreadSyncDetails {
    pub root_message_index: MessageIndex,
    pub latest_event: Option<EventIndex>,
    pub latest_message: Option<MessageIndex>,
    pub read_up_to: Option<MessageIndex>,
    pub last_updated: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct ThreadSyncDetailsInternal {
    pub root_message_index: MessageIndex,
    pub latest_event: EventIndex,
    pub latest_message: MessageIndex,
    pub last_updated: TimestampMillis,
}

impl From<ThreadSyncDetailsInternal> for ThreadSyncDetails {
    fn from(s: ThreadSyncDetailsInternal) -> Self {
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
pub struct GroupRules {
    pub text: String,
    pub enabled: bool,
}
