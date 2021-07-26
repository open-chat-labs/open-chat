use crate::common::message::Message;
use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::chat_id::{DirectChatId, GroupChatId};
use shared::types::UserId;

#[derive(CandidType, Deserialize)]
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

#[derive(CandidType, Deserialize)]
pub struct DirectChatSummary {
    pub them: UserId,
    pub chat_id: DirectChatId,
    pub latest_message: Message,
    pub date_created: TimestampMillis,
}

impl DirectChatSummary {
    pub fn display_date(&self) -> TimestampMillis {
        self.latest_message.timestamp
    }
}

#[derive(CandidType, Deserialize)]
pub struct GroupChatSummary {
    pub name: String,
    pub chat_id: GroupChatId,
    pub latest_message: Option<Message>,
    pub date_added: TimestampMillis,
}

impl GroupChatSummary {
    pub fn display_date(&self) -> TimestampMillis {
        self.latest_message.as_ref().map_or(self.date_added, |m| m.timestamp)
    }
}
