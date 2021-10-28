use crate::{ChatId, EventIndex, EventWrapper, Message, MessageIndex, MessageIndexRange, Role, TimestampMillis, UserId};
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
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatSummaryUpdates {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub name: Option<String>,
    pub description: Option<String>,
    pub avatar_id: Option<u128>,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: Option<EventIndex>,
    pub read_by_me: Option<Vec<MessageIndexRange>>,
    pub notifications_muted: Option<bool>,
    pub participant_count: Option<u32>,
    pub role: Option<Role>,
}
