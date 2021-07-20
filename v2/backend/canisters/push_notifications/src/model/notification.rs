use candid::CandidType;
use serde::Deserialize;
use shared::types::chat_id::GroupChatId;
use shared::types::{MessageIndex, UserId};

#[derive(CandidType, Deserialize, Clone)]
pub struct IndexedNotification {
    pub index: u64,
    pub notification: Notification,
}

#[derive(CandidType, Deserialize, Clone)]
pub enum Notification {
    DirectMessageNotification(DirectMessageNotification),
    GroupMessageNotification(GroupMessageNotification),
}

#[derive(CandidType, Deserialize, Clone)]
pub struct DirectMessageNotification {
    pub sender: UserId,
    pub recipient: UserId,
    pub message_index: MessageIndex,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct GroupMessageNotification {
    pub chat_id: GroupChatId,
    pub sender: UserId,
    pub recipients: Vec<UserId>,
    pub message_index: MessageIndex,
}
