use crate::chat_id::ChatId;
use crate::UserId;
use crate::{message, v1_message};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct NotificationEnvelope {
    pub recipients: Vec<UserId>,
    pub notification: Notification,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum Notification {
    DirectMessageNotification(DirectMessageNotification),
    GroupMessageNotification(GroupMessageNotification),
    V1DirectMessageNotification(V1DirectMessageNotification),
    V1GroupMessageNotification(V1GroupMessageNotification),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DirectMessageNotification {
    pub sender: UserId,
    pub sender_name: String,
    pub message: message::DirectMessage,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupMessageNotification {
    pub chat_id: ChatId,
    pub group_name: String,
    pub sender: UserId,
    pub sender_name: String,
    pub message: message::GroupMessage,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct V1DirectMessageNotification {
    pub sender: UserId,
    pub sender_name: String,
    pub message: v1_message::Message,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct V1GroupMessageNotification {
    pub chat_id: u128,
    pub group_name: String,
    pub sender: UserId,
    pub sender_name: String,
    pub message: v1_message::Message,
}
