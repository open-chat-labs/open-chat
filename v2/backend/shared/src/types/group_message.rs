use crate::types::message_content::MessageContent;
use crate::types::{EventIndex, MessageId, MessageIndex, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Message {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContext>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ReplyContext {
    pub event_index: EventIndex,
    pub user_id: UserId,
    pub content: MessageContent,
}
