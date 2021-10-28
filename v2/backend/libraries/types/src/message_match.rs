use crate::{ChatId, MessageContent, MessageIndex, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MessageMatch {
    pub chat_id: ChatId,
    pub sender: UserId,
    pub message_index: MessageIndex,
    pub content: MessageContent,
    pub score: u32,
}
