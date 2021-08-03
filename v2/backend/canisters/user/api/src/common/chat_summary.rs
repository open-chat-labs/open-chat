use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::chat_id::{DirectChatId, GroupChatId};
use shared::types::{direct_message, group_message};
use shared::types::{Event, EventIndex, UserId};

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
    pub them: UserId,
    pub chat_id: DirectChatId,
    pub latest_message: Event<direct_message::Message>,
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
    pub name: String,
    pub chat_id: GroupChatId,
    pub latest_message: Option<Event<group_message::Message>>,
    pub latest_event_index: EventIndex,
    pub date_added: TimestampMillis,
}

impl GroupChatSummary {
    pub fn display_date(&self) -> TimestampMillis {
        self.latest_message.as_ref().map_or(self.date_added, |m| m.timestamp)
    }
}
