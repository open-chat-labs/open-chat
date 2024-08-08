use crate::{MessageContentInitial, MessageId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct BotConfig {
    pub supports_direct_messages: bool,
    pub can_be_added_to_groups: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct BotMessage {
    pub thread_root_message_id: Option<MessageId>,
    pub content: MessageContentInitial,
    pub message_id: Option<MessageId>,
    pub block_level_markdown: Option<bool>,
}
