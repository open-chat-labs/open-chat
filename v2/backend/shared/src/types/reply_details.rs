use super::chat_id::GroupChatId;
use super::message_content::MessageContent;
use super::{MessageId, MessageIndex, UserId};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone)]
pub struct ReplyDetails {
    pub message_index: MessageIndex,
    pub user_id: UserId,
    pub content: MessageContent,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct PrivateReplyDetails {
    pub chat_id: GroupChatId,
    pub message_id: MessageId,
    pub user_id: UserId,
    pub content: MessageContent,
}
