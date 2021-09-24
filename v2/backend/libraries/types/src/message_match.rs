use crate::{ChatId, EventIndex, MessageContent, UserId};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct MessageMatch {
    pub chat_id: ChatId,
    pub sender: UserId,
    pub event_index: EventIndex,
    pub content: MessageContent,
    pub score: u32,
}
