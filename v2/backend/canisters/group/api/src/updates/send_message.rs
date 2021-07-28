use crate::common::reply_context::ReplyContextInternal;
use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::message_content::MessageContent;
use shared::types::{MessageId, MessageIndex};

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub message_id: MessageId,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContextInternal>,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NotInGroup,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
}
