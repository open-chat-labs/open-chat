use crate::{ChatId, EventIndex, MessageContent, UserId};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct UserMessageMatch {
    pub sent_by_me: bool,
    pub event_index: EventIndex,
    pub content: MessageContent,
    pub score: u32,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GroupMessageMatch {
    pub sender: UserId,
    pub event_index: EventIndex,
    pub content: MessageContent,
    pub score: u32,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct CombinedMessageMatch {
    pub chat_id: ChatId,
    pub sender: UserId,
    pub event_index: EventIndex,
    pub content: MessageContent,
    pub score: u32,
}
