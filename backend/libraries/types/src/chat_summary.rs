use crate::{
    ChatId, EventIndex, EventWrapper, GroupPermissions, Mention, Message, MessageIndex, MessageIndexRange, OptionUpdate, Role,
    TimestampMillis, UserId, Version,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};

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

#[derive(CandidType, Deserialize, Clone, Debug)]
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
        }
    }
}

#[derive(CandidType, Deserialize, Clone, Debug)]
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
        }
    }
}
