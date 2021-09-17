use crate::chat_id::ChatId;
use crate::message_content::MessageContent;
use crate::{EventIndex, MessageId, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum DirectReplyContext {
    Standard(StandardReplyContext),
    Private(PrivateReplyContext),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct StandardReplyContext {
    pub event_index: EventIndex,
    pub message_id: MessageId,
    pub sent_by_me: bool,
    pub content: MessageContent,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PrivateReplyContext {
    pub chat_id: ChatId,
    pub event_index: EventIndex,
    pub message_id: MessageId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupReplyContext {
    pub event_index: EventIndex,
    pub message_id: MessageId,
    pub user_id: UserId,
    pub content: MessageContent,
}
