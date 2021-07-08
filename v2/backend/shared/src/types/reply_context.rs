use crate::types::message_content::MessageContent;
use crate::types::{chat_id::GroupChatId, MessageId, UserId};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone)]
pub struct ReplyContext {
    chat_id_if_other: Option<GroupChatId>,
    user_id: UserId,
    message_id: MessageId,
    content: MessageContent,
}
