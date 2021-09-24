use candid::CandidType;
use serde::Deserialize;
use types::{EventIndex, MessageContent, MessageId, MessageIndex, ReplyContextArgs, TimestampMillis};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub content: MessageContent,
    pub sender_name: String,
    pub replies_to: Option<ReplyContextArgs>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotInGroup,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
}
