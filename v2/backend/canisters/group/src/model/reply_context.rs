use candid::CandidType;
use serde::Deserialize;
use shared::types::{MessageIndex, UserId};
use shared::types::message_content::MessageContent;

#[derive(CandidType, Deserialize)]
pub struct ReplyContextInternal {
    pub message_index: MessageIndex,
}

#[derive(CandidType)]
pub struct ReplyContext {
    pub message_index: MessageIndex,
    pub user_id: UserId,
    pub content: MessageContent,
}