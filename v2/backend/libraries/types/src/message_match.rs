use crate::{MessageContent, UserId};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct MessageMatch {
    pub sender: UserId,
    pub content: MessageContent,
    pub score: u32,
}
