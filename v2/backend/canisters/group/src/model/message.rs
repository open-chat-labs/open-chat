use crate::model::reply_context::{ReplyContext, ReplyContextInternal};
use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::{MessageId, MessageIndex, UserId};
use shared::types::message_content::MessageContent;

#[derive(CandidType, Deserialize)]
pub struct MessageInternal {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub timestamp: TimestampMillis,
    pub sender: UserId,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContextInternal>,
}

#[derive(CandidType)]
pub struct Message {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub timestamp: TimestampMillis,
    pub sender: UserId,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContext>,
}
