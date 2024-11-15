use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Chat, EventIndex, InvalidPollReason, MessageId, MessageIndex, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageId>,
    pub text: String,
    pub message_id: Option<MessageId>,
}

pub type Response = Result<SuccessResult, Error>;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Error {
    ThreadMessageNotFound,
    MessageEmpty,
    TextTooLong(u32),
    NotAuthorized,
    ChatFrozen,
    CallError(i32, String),
    Other(String),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
}
