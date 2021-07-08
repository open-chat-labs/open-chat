use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::{message_content::MessageContent, reply_context::ReplyContext, MessageId, MessageIndex};

#[derive(CandidType, Deserialize, Clone)]
pub struct Message {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub timestamp: TimestampMillis,
    pub sent_by_me: bool,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContext>,
}
