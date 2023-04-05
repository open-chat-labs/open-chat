use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, FieldTooLongResult, MessageIndex, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub notes: Option<String>,
    pub remind_at: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotesTooLong(FieldTooLongResult),
    UserSuspended,
}
