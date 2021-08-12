use candid::CandidType;
use serde::Deserialize;
use types::message_content::MessageContent;
use types::reply_context::GroupReplyContextInternal;
use types::{EventIndex, MessageId, MessageIndex, TimestampMillis};

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub message_id: MessageId,
    pub content: MessageContent,
    pub sender_name: String,
    pub replies_to: Option<GroupReplyContextInternal>,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NotInGroup,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
}
