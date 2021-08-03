use crate::types::chat_id::GroupChatId;
use crate::types::UserId;
use crate::types::{direct_message, group_message};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub enum Notification {
    DirectMessageNotification(DirectMessageNotification),
    GroupMessageNotification(GroupMessageNotification),
    V1GroupMessageNotification(V1GroupMessageNotification),
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct DirectMessageNotification {
    pub sender: UserId,
    pub recipient: UserId,
    pub message: direct_message::Message,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct GroupMessageNotification {
    pub chat_id: GroupChatId,
    pub sender: UserId,
    pub recipients: Vec<UserId>,
    pub message: group_message::Message,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct V1GroupMessageNotification {
    pub chat_id: u128,
    pub sender: UserId,
    pub recipients: Vec<UserId>,
    pub message: group_message::Message,
}
