use crate::{
    ChatId, CommunityGroupId, CommunityId, EventWrapper, Message, MessageIndex, Reaction, TimestampMillis, User, UserId,
};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct NotificationEnvelope {
    pub recipients: Vec<UserId>,
    pub notification_bytes: Vec<u8>,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum Notification {
    AddedToGroupNotification(AddedToGroupNotification),
    DirectMessageNotification(DirectMessageNotification),
    GroupMessageNotification(GroupMessageNotification),
    CommunityMessageNotification(CommunityMessageNotification),
    DirectReactionAddedNotification(DirectReactionAddedNotification),
    GroupReactionAddedNotification(GroupReactionAddedNotification),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AddedToGroupNotification {
    pub chat_id: ChatId,
    pub group_name: String,
    pub added_by: UserId,
    pub added_by_name: String,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DirectMessageNotification {
    pub sender: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub sender_name: String,
    pub message: EventWrapper<Message>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupMessageNotification {
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub group_name: String,
    pub sender: UserId,
    pub sender_name: String,
    pub message: EventWrapper<Message>,
    pub mentioned: Vec<User>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityMessageNotification {
    pub community_id: CommunityId,
    pub group_id: CommunityGroupId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub community_name: String,
    pub group_name: String,
    pub sender: UserId,
    pub sender_name: String,
    pub message: EventWrapper<Message>,
    pub mentioned: Vec<User>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DirectReactionAddedNotification {
    pub them: UserId,
    pub username: String,
    pub message: EventWrapper<Message>,
    pub reaction: Reaction,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupReactionAddedNotification {
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub group_name: String,
    pub added_by: UserId,
    pub added_by_name: String,
    pub message: EventWrapper<Message>,
    pub reaction: Reaction,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct CanPushNotificationsArgs {
    pub principal: Principal,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum CanPushNotificationsResponse {
    Success(bool),
}
