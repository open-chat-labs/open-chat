use crate::time::TimestampMillis;
use crate::types::message_content::MessageContent;
use crate::types::{MessageId, MessageIndex, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct Message {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub timestamp: TimestampMillis,
    pub sender: UserId,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContext>,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct ReplyContext {
    pub message_index: MessageIndex,
    pub user_id: UserId,
    pub content: MessageContent,
}
