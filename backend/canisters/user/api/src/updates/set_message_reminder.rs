use crate::set_message_reminder_v2;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, EventIndex, MessageIndex, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub event_index: EventIndex,
    pub notes: Option<String>,
    pub remind_at: TimestampMillis,
}

pub type Response = set_message_reminder_v2::Response;
