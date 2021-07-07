use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::{message_content::MessageContent, reply_context::ReplyContext, MessageId};

#[derive(CandidType, Deserialize, Clone)]
pub struct Message {
    pub id: MessageId,
    pub client_message_id: u128,
    pub timestamp: TimestampMillis,
    pub sent_by_me: bool,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContext>,
}
