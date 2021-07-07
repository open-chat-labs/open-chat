use crate::types::message_content::MessageContent;
use crate::types::{ChatId, MessageId, UserId};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone)]
pub struct ReplyContext {
    chat_id: ChatId,
    user_id: UserId,
    message_id: MessageId,
    content: MessageContent,
}
