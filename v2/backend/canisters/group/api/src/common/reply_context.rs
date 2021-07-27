use candid::CandidType;
use serde::Deserialize;
use shared::types::message_content::MessageContent;
use shared::types::{MessageIndex, UserId};

#[derive(CandidType, Deserialize)]
pub struct ReplyContextInternal {
    pub message_index: MessageIndex,
}

#[derive(CandidType, Deserialize)]
pub struct ReplyContext {
    pub message_index: MessageIndex,
    pub user_id: UserId,
    pub content: MessageContent,
}
