use crate::chat_id::{DirectChatId, GroupChatId};
use crate::participant::Participant;
use crate::TimestampMillis;
use crate::{message, EventIndex, EventWrapper, MessageIndex, UserId};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Debug)]
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

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct DirectChatSummary {
    pub chat_id: DirectChatId,
    pub them: UserId,
    pub latest_message: EventWrapper<message::DirectMessage>,
    pub latest_event_index: EventIndex,
    pub date_created: TimestampMillis,
    pub latest_read_by_me: MessageIndex,
    pub latest_read_by_them: MessageIndex,
}

impl DirectChatSummary {
    pub fn display_date(&self) -> TimestampMillis {
        self.latest_message.timestamp
    }
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GroupChatSummary {
    pub chat_id: GroupChatId,
    pub name: String,
    pub description: String,
    pub is_public: bool,
    pub min_visible_message_index: MessageIndex,
    pub participants: Vec<Participant>,
    pub latest_message: Option<EventWrapper<message::GroupMessage>>,
    pub latest_event_index: EventIndex,
    pub joined: TimestampMillis,
    pub latest_read_by_me: MessageIndex,
}

impl GroupChatSummary {
    pub fn display_date(&self) -> TimestampMillis {
        self.latest_message.as_ref().map_or(self.joined, |m| m.timestamp)
    }
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum ChatSummaryUpdates {
    Direct(DirectChatSummaryUpdates),
    Group(GroupChatSummaryUpdates),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct DirectChatSummaryUpdates {
    pub chat_id: DirectChatId,
    pub latest_message: Option<EventWrapper<message::DirectMessage>>,
    pub latest_event_index: Option<EventIndex>,
    pub latest_read_by_me: Option<MessageIndex>,
    pub latest_read_by_them: Option<MessageIndex>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GroupChatSummaryUpdates {
    pub chat_id: GroupChatId,
    pub timestamp: TimestampMillis,
    pub name: Option<String>,
    pub description: Option<String>,
    pub participants_added_or_updated: Vec<Participant>,
    pub participants_removed: Vec<UserId>,
    pub latest_message: Option<EventWrapper<message::GroupMessage>>,
    pub latest_event_index: Option<EventIndex>,
    pub latest_read_by_me: Option<MessageIndex>,
}
