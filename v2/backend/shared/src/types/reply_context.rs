use crate::types::message_content::MessageContent;
use crate::types::{chat_id::GroupChatId, UserId};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone)]
pub struct ReplyContext {
    chat_id_if_other: Option<GroupChatId>,
    user_id: UserId,
    client_message_id: u128,
    content: MessageContent,
}
