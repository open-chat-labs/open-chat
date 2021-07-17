use crate::types::chat_id::GroupChatId;
use crate::types::message_content::MessageContent;
use crate::types::{MessageIndex, UserId};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone)]
pub struct DirectMessageNotification {
    pub sender: UserId,
    pub recipient: UserId,
    pub message_index: MessageIndex,
    pub content: MessageContent,
}

#[derive(CandidType, Deserialize)]
pub enum PushDirectMessageNotificationResponse {
    Success,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct GroupMessageNotification {
    pub chat_id: GroupChatId,
    pub sender: UserId,
    pub recipients: Vec<UserId>,
    pub message_index: MessageIndex,
    pub content: MessageContent,
}

#[derive(CandidType, Deserialize)]
pub enum PushGroupMessageNotificationResponse {
    Success,
}
