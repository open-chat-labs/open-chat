use crate::{MessageContentInitial, MessageId};
use candid::CandidType;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Clone, Debug, Default)]
pub struct BotConfig {
    pub is_oc_controlled: bool,
    pub supports_direct_messages: bool,
    pub can_be_added_to_groups: bool,
}

#[ts_export]
#[derive(CandidType, Debug)]
pub struct BotMessage {
    pub thread_root_message_id: Option<MessageId>,
    pub content: MessageContentInitial,
    pub message_id: Option<MessageId>,
    pub block_level_markdown: Option<bool>,
}
