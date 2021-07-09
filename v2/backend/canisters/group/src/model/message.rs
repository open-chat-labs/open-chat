use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::reply_details::ReplyDetails;
use shared::types::{message_content::MessageContent, MessageId, MessageIndex, UserId};

#[derive(CandidType, Deserialize, Clone)]
pub struct Message {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub timestamp: TimestampMillis,
    pub sender: UserId,
    pub content: MessageContent,
    pub replies_to: Option<ReplyDetails>,
}
