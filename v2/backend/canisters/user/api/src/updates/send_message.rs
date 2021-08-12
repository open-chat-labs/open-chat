use candid::CandidType;
use serde::Deserialize;
use types::chat_id::DirectChatId;
use types::message_content::MessageContent;
use types::reply_context::DirectReplyContextInternal;
use types::{EventIndex, MessageId, MessageIndex, TimestampMillis, UserId};

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub message_id: MessageId,
    pub recipient: UserId,
    pub sender_name: String,
    pub content: MessageContent,
    pub replies_to: Option<DirectReplyContextInternal>,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorised,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    pub direct_chat_id: DirectChatId,
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
}
