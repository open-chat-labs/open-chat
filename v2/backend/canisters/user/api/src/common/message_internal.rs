use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::chat_id::GroupChatId;
use shared::types::{message_content::MessageContent, MessageId, MessageIndex};

#[derive(CandidType, Deserialize)]
pub struct MessageInternal {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub timestamp: TimestampMillis,
    pub sent_by_me: bool,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContextInternal>,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct ReplyContextInternal {
    pub chat_id_if_other: Option<GroupChatId>,
    pub message_index: MessageIndex,
}
