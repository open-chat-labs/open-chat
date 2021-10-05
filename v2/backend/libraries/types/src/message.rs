use crate::{ChatId, EventIndex, MessageContent, MessageId, MessageIndex, Reaction, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Message {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContext>,
    pub reactions: Vec<(Reaction, Vec<UserId>)>,
    pub edited: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DeletedMessage {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub deletion_event_index: EventIndex,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ReplyContext {
    pub chat_id: ChatId,
    pub sender: UserId,
    pub event_index: EventIndex,
    pub message_id: MessageId,
    pub content: MessageContent,
}
