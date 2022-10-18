use crate::MessageContent;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct BotMessage {
    pub content: MessageContent,
}
