use crate::{ChannelId, ChatId, CommunityId, MessageIndex, Reaction, TimestampMillis, UserId};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::fmt::{Debug, Formatter};

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct NotificationEnvelope {
    pub recipients: Vec<UserId>,
    pub notification_bytes: ByteBuf,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize)]
#[serde(tag = "kind")]
pub enum Notification {
    AddedToChannel(AddedToChannelNotification),
    AddedToGroup(AddedToGroupNotification),
    DirectMessage(DirectMessageNotification),
    GroupMessage(GroupMessageNotification),
    ChannelMessage(ChannelMessageNotification),
    DirectReactionAdded(DirectReactionAddedNotification),
    GroupReactionAdded(GroupReactionAddedNotification),
    ChannelReactionAdded(ChannelReactionAddedNotification),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AddedToGroupNotification {
    pub chat_id: ChatId,
    pub group_name: String,
    pub added_by: UserId,
    pub added_by_name: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AddedToChannelNotification {
    pub community_id: CommunityId,
    pub community_name: String,
    pub channel_id: ChannelId,
    pub channel_name: String,
    pub added_by: UserId,
    pub added_by_name: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DirectMessageNotification {
    pub sender: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub sender_name: String,
    pub message_text: String,
    pub thumbnail: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupMessageNotification {
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub group_name: String,
    pub sender: UserId,
    pub sender_name: String,
    pub message_text: String,
    pub thumbnail: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChannelMessageNotification {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub community_name: String,
    pub channel_name: String,
    pub sender: UserId,
    pub sender_name: String,
    pub message_text: String,
    pub thumbnail: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DirectReactionAddedNotification {
    pub them: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub username: String,
    pub reaction: Reaction,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupReactionAddedNotification {
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub group_name: String,
    pub added_by: UserId,
    pub added_by_name: String,
    pub reaction: Reaction,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChannelReactionAddedNotification {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub community_name: String,
    pub channel_name: String,
    pub added_by: UserId,
    pub added_by_name: String,
    pub reaction: Reaction,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct CanPushNotificationsArgs {
    pub principal: Principal,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum CanPushNotificationsResponse {
    Success(bool),
}

impl Debug for NotificationEnvelope {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NotificationEnvelope")
            .field("recipients", &self.recipients.len())
            .field("notification_bytes", &self.notification_bytes.len())
            .field("timestamp", &self.timestamp)
            .finish()
    }
}
