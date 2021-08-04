use crate::types::chat_id::GroupChatId;
use crate::types::{message_content::MessageContent, EventIndex, MessageId, MessageIndex};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Message {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sent_by_me: bool,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContext>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ReplyContext {
    Standard(StandardReplyContext),
    Private(PrivateReplyContext),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct StandardReplyContext {
    pub event_index: EventIndex,
    pub sent_by_me: bool,
    pub content: MessageContent,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PrivateReplyContext {
    pub chat_id: GroupChatId,
    pub event_index: EventIndex,
}
