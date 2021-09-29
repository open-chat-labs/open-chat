use crate::{ChatId, EventIndex, MessageContent, UserId};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum MessageMatch {
    Direct(DirectMessageMatch),
    Group(GroupMessageMatch),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct DirectMessageMatch {
    pub chat_id: ChatId,
    pub event_index: EventIndex,
    pub content: MessageContent,
    pub score: u32,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GroupMessageMatch {
    pub chat_id: ChatId,
    pub event_index: EventIndex,
    pub content: MessageContent,
    pub score: u32,
    pub group_name: String,
    pub avatar_id: Option<u128>,
    pub sender: UserId,
}

impl MessageMatch {
    pub fn score(&self) -> u32 {
        match self {
            MessageMatch::Direct(m) => m.score,
            MessageMatch::Group(m) => m.score,
        }
    }
}