use crate::{MessageContentInitial, MessageId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, TS)]
pub struct BotConfig {
    pub is_oc_controlled: bool,
    pub supports_direct_messages: bool,
    pub can_be_added_to_groups: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct BotMessage {
    pub thread_root_message_id: Option<MessageId>,
    pub content: MessageContentInitial,
    pub message_id: Option<MessageId>,
    pub block_level_markdown: Option<bool>,
}
