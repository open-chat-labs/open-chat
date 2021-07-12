use candid::CandidType;
use serde::Deserialize;
use shared::types::chat_id::GroupChatId;
use shared::types::message_content::MessageContent;
use shared::types::{MessageIndex, UserId};

#[derive(CandidType, Deserialize, Clone)]
pub struct ReplyContextInternal {
    pub chat_id_if_other: Option<GroupChatId>,
    pub message_index: MessageIndex,
}

#[derive(CandidType)]
pub struct ReplyContext {
    pub chat_id_if_other: Option<GroupChatId>,
    pub message_index: MessageIndex,
    pub user_id: UserId,
    pub content: MessageContent,
}
