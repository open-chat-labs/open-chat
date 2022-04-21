use crate::{
    ChatId, EventIndex, EventWrapper, GroupPermissions, Mention, Message, MessageIndex, MessageIndexRange, OptionUpdate, Role,
    TimestampMillis, UserId, Version, MAX_RETURNED_MENTIONS,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::cmp::max;

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
    pub read_by_me: Vec<MessageIndexRange>,
    pub read_by_them: Vec<MessageIndexRange>,
    pub notifications_muted: bool,
    pub metrics: ChatMetrics,
    pub my_metrics: ChatMetrics,
}

impl DirectChatSummary {
    pub fn display_date(&self) -> TimestampMillis {
        self.latest_message.timestamp
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatSummary {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub is_public: bool,
    pub min_visible_event_index: EventIndex,
    pub min_visible_message_index: MessageIndex,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub joined: TimestampMillis,
    pub read_by_me: Vec<MessageIndexRange>,
    pub notifications_muted: bool,
    pub participant_count: u32,
    pub role: Role,
    pub mentions: Vec<Mention>,
    pub pinned_message: Option<MessageIndex>,
    pub wasm_version: Version,
    pub owner_id: UserId,
    pub permissions: GroupPermissions,
    pub metrics: ChatMetrics,
    pub my_metrics: ChatMetrics,
}

impl GroupChatSummary {
    pub fn display_date(&self) -> TimestampMillis {
        self.latest_message.as_ref().map_or(self.joined, |m| m.timestamp)
    }
}

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
    pub read_by_me: Option<Vec<MessageIndexRange>>,
    pub read_by_them: Option<Vec<MessageIndexRange>>,
    pub notifications_muted: Option<bool>,
    pub affected_events: Vec<EventIndex>,
    pub metrics: Option<ChatMetrics>,
    pub my_metrics: Option<ChatMetrics>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatSummaryUpdates {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub name: Option<String>,
    pub description: Option<String>,
    pub avatar_id: OptionUpdate<u128>,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: Option<EventIndex>,
    pub read_by_me: Option<Vec<MessageIndexRange>>,
    pub notifications_muted: Option<bool>,
    pub participant_count: Option<u32>,
    pub role: Option<Role>,
    pub mentions: Vec<Mention>,
    pub pinned_message: OptionUpdate<MessageIndex>,
    pub wasm_version: Option<Version>,
    pub owner_id: Option<UserId>,
    pub permissions: Option<GroupPermissions>,
    pub affected_events: Vec<EventIndex>,
    pub metrics: Option<ChatMetrics>,
    pub my_metrics: Option<ChatMetrics>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PublicGroupSummary {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub participant_count: u32,
    pub pinned_message: Option<MessageIndex>,
    pub wasm_version: Version,
    pub owner_id: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatSummaryInternal {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub is_public: bool,
    pub min_visible_event_index: EventIndex,
    pub min_visible_message_index: MessageIndex,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub joined: TimestampMillis,
    pub participant_count: u32,
    pub role: Role,
    pub mentions: Vec<Mention>,
    pub pinned_message: Option<MessageIndex>,
    pub wasm_version: Version,
    pub owner_id: UserId,
    pub permissions: GroupPermissions,
    pub notifications_muted: bool,
    pub metrics: ChatMetrics,
    pub my_metrics: ChatMetrics,
}

impl GroupChatSummaryInternal {
    pub fn merge_updates(&mut self, updates: GroupChatSummaryUpdatesInternal) {
        if self.chat_id != updates.chat_id {
            panic!(
                "Updates are not from the same chat. Original: {}. Updates: {}",
                self.chat_id, updates.chat_id
            );
        }

        self.last_updated = updates.last_updated;
        Self::update_if_some(&mut self.name, updates.name);
        Self::update_if_some(&mut self.description, updates.description);
        Self::update_option_if_some(&mut self.latest_message, updates.latest_message);
        Self::update_if_some(&mut self.latest_event_index, updates.latest_event_index);
        Self::update_if_some(&mut self.participant_count, updates.participant_count);
        Self::update_if_some(&mut self.role, updates.role);
        Self::update_if_some(&mut self.wasm_version, updates.wasm_version);
        Self::update_if_some(&mut self.owner_id, updates.owner_id);
        Self::update_if_some(&mut self.permissions, updates.permissions);
        Self::update_if_some(&mut self.metrics, updates.metrics);
        Self::update_if_some(&mut self.my_metrics, updates.my_metrics);

        match updates.avatar_id {
            OptionUpdate::SetToSome(avatar_id) => self.avatar_id = Some(avatar_id),
            OptionUpdate::SetToNone => self.avatar_id = None,
            OptionUpdate::NoChange => {}
        };

        self.mentions.extend(updates.mentions);
        let mentions_to_remove = self.mentions.len().saturating_sub(MAX_RETURNED_MENTIONS);
        if mentions_to_remove > 0 {
            self.mentions.drain(..mentions_to_remove);
        }
    }

    fn update_if_some<T>(current: &mut T, update: Option<T>) {
        if let Some(updated) = update {
            *current = updated;
        }
    }

    fn update_option_if_some<T>(current: &mut Option<T>, update: Option<T>) {
        if let Some(updated) = update {
            *current = Some(updated);
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
            avatar_id: s.avatar_id,
            is_public: s.is_public,
            min_visible_event_index: s.min_visible_event_index,
            min_visible_message_index: s.min_visible_message_index,
            latest_message: s.latest_message,
            latest_event_index: s.latest_event_index,
            joined: s.joined,
            read_by_me: vec![],
            notifications_muted: s.notifications_muted,
            participant_count: s.participant_count,
            role: s.role,
            mentions: s.mentions,
            pinned_message: s.pinned_message,
            wasm_version: s.wasm_version,
            owner_id: s.owner_id,
            permissions: s.permissions,
            metrics: s.metrics,
            my_metrics: s.my_metrics,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatSummaryUpdatesInternal {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub name: Option<String>,
    pub description: Option<String>,
    pub avatar_id: OptionUpdate<u128>,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: Option<EventIndex>,
    pub participant_count: Option<u32>,
    pub role: Option<Role>,
    pub mentions: Vec<Mention>,
    pub pinned_message: OptionUpdate<MessageIndex>,
    pub wasm_version: Option<Version>,
    pub owner_id: Option<UserId>,
    pub permissions: Option<GroupPermissions>,
    pub affected_events: Vec<EventIndex>,
    pub metrics: Option<ChatMetrics>,
    pub my_metrics: Option<ChatMetrics>,
}

impl From<GroupChatSummaryUpdatesInternal> for GroupChatSummaryUpdates {
    fn from(s: GroupChatSummaryUpdatesInternal) -> Self {
        GroupChatSummaryUpdates {
            chat_id: s.chat_id,
            last_updated: s.last_updated,
            name: s.name,
            description: s.description,
            avatar_id: s.avatar_id,
            latest_message: s.latest_message,
            latest_event_index: s.latest_event_index,
            participant_count: s.participant_count,
            role: s.role,
            read_by_me: None,
            notifications_muted: None,
            mentions: s.mentions,
            pinned_message: s.pinned_message,
            wasm_version: s.wasm_version,
            owner_id: s.owner_id,
            permissions: s.permissions,
            affected_events: s.affected_events,
            metrics: s.metrics,
            my_metrics: s.my_metrics,
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
        self.last_active = max(self.last_active, other.last_active);
    }
}
