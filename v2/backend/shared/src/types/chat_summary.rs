use crate::time::TimestampMillis;
use crate::types::chat_id::{DirectChatId, GroupChatId};
use crate::types::participant::Participant;
use crate::types::{direct_message, group_message, EventIndex, EventWrapper, UserId};
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
    pub latest_message: EventWrapper<direct_message::Message>,
    pub latest_event_index: EventIndex,
    pub date_created: TimestampMillis,
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
    pub participants: Vec<Participant>,
    pub latest_message: Option<EventWrapper<group_message::Message>>,
    pub latest_event_index: EventIndex,
    pub date_added: TimestampMillis,
}

impl GroupChatSummary {
    pub fn display_date(&self) -> TimestampMillis {
        self.latest_message.as_ref().map_or(self.date_added, |m| m.timestamp)
    }
}
