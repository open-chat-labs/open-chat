use crate::common::reply_context_internal::ReplyContextInternal;
use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::chat_id::DirectChatId;
use shared::types::message_content::MessageContent;
use shared::types::{EventIndex, MessageId, MessageIndex, UserId};

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub message_id: MessageId,
    pub recipient: UserId,
    pub sender_name: String,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContextInternal>,
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
