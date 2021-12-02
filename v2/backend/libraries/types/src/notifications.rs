use crate::{ChatId, Message, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct NotificationEnvelope {
    pub recipients: Vec<UserId>,
    pub notification: Notification,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum Notification {
    AddedToGroupNotification(AddedToGroupNotification),
    DirectMessageNotification(DirectMessageNotification),
    GroupMessageNotification(GroupMessageNotification),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AddedToGroupNotification {
    pub chat_id: ChatId,
    pub group_name: String,
    pub added_by: UserId,
    pub added_by_name: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DirectMessageNotification {
    pub sender: UserId,
    pub sender_name: String,
    pub message: Message,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupMessageNotification {
    pub chat_id: ChatId,
    pub group_name: String,
    pub sender: UserId,
    pub sender_name: String,
    pub message: Message,
}
