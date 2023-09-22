use crate::{MessageContentInitial, MessageId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct BotMessage {
    pub content: MessageContentInitial,
    #[serde(default)]
    pub message_id: Option<MessageId>,
}
