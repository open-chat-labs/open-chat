use crate::types::chat_id::GroupChatId;
use crate::types::{MessageIndex, UserId};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone)]
pub struct IndexedEvent {
    pub index: u64,
    pub event: Event,
}

#[derive(CandidType, Deserialize, Clone)]
pub enum Event {
    DirectMessageNotification(DirectMessageNotification),
    GroupMessageNotification(GroupMessageNotification),
    Subscription(Subscription),
}

#[derive(CandidType, Deserialize, Clone)]
pub struct Subscription {
    pub user_id: UserId,
    pub subscription: String,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct DirectMessageNotification {
    pub sender: UserId,
    pub recipient: UserId,
    pub message_index: MessageIndex,
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
}

#[derive(CandidType, Deserialize)]
pub enum PushGroupMessageNotificationResponse {
    Success,
}
