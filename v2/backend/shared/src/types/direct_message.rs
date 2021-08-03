use crate::time::TimestampMillis;
use crate::types::chat_id::GroupChatId;
use crate::types::{message_content::MessageContent, MessageId, MessageIndex};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct Message {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub timestamp: TimestampMillis,
    pub sent_by_me: bool,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContext>,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub enum ReplyContext {
    Standard(StandardReplyContext),
    Private(PrivateReplyContext),
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct StandardReplyContext {
    pub message_index: MessageIndex,
    pub sent_by_me: bool,
    pub content: MessageContent,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct PrivateReplyContext {
    pub chat_id: GroupChatId,
    pub message_index: MessageIndex,
}
