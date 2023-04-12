use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, EventIndex, FieldTooLongResult, MessageIndex, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub event_index: EventIndex,
    pub notes: Option<String>,
    pub remind_at: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ReminderDateInThePast,
    NotesTooLong(FieldTooLongResult),
    UserSuspended,
}
