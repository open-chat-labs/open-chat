use crate::MessageContentInternal;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct BotMessage {
    pub content: MessageContentInternal,
}
