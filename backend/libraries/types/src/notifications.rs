use crate::{CanisterId, ChannelId, ChatId, CommunityId, EventIndex, MessageIndex, Reaction, TimestampMillis, UserId};
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
pub enum Notification {
    AddedToChannel(AddedToChannelNotification),
    DirectMessage(DirectMessageNotification),
    GroupMessage(GroupMessageNotification),
    ChannelMessage(ChannelMessageNotification),
    DirectReactionAdded(DirectReactionAddedNotification),
    GroupReactionAdded(GroupReactionAddedNotification),
    ChannelReactionAdded(ChannelReactionAddedNotification),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AddedToChannelNotification {
    pub community_id: CommunityId,
    pub community_name: String,
    pub channel_id: ChannelId,
    pub channel_name: String,
    pub added_by: UserId,
    pub added_by_name: String,
    pub community_avatar_id: Option<u128>,
    pub channel_avatar_id: Option<u128>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DirectMessageNotification {
    pub sender: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub event_index: EventIndex,
    pub sender_name: String,
    pub message_type: String,
    pub message_text: Option<String>,
    pub image_url: Option<String>,
    pub sender_avatar_id: Option<u128>,
    pub crypto_transfer: Option<CryptoTransferDetails>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupMessageNotification {
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub event_index: EventIndex,
    pub group_name: String,
    pub sender: UserId,
    pub sender_name: String,
    pub message_type: String,
    pub message_text: Option<String>,
    pub image_url: Option<String>,
    pub group_avatar_id: Option<u128>,
    pub crypto_transfer: Option<CryptoTransferDetails>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChannelMessageNotification {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub event_index: EventIndex,
    pub community_name: String,
    pub channel_name: String,
    pub sender: UserId,
    pub sender_name: String,
    pub message_type: String,
    pub message_text: Option<String>,
    pub image_url: Option<String>,
    pub community_avatar_id: Option<u128>,
    pub channel_avatar_id: Option<u128>,
    pub crypto_transfer: Option<CryptoTransferDetails>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DirectReactionAddedNotification {
    pub them: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_event_index: EventIndex,
    pub username: String,
    pub reaction: Reaction,
    pub user_avatar_id: Option<u128>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupReactionAddedNotification {
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_event_index: EventIndex,
    pub group_name: String,
    pub added_by: UserId,
    pub added_by_name: String,
    pub reaction: Reaction,
    pub group_avatar_id: Option<u128>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChannelReactionAddedNotification {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_event_index: EventIndex,
    pub community_name: String,
    pub channel_name: String,
    pub added_by: UserId,
    pub added_by_name: String,
    pub reaction: Reaction,
    pub community_avatar_id: Option<u128>,
    pub channel_avatar_id: Option<u128>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CryptoTransferDetails {
    pub recipient: UserId,
    pub recipient_username: Option<String>,
    pub ledger: CanisterId,
    pub symbol: String,
    pub amount: u128,
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

#[test]
fn notification_length() {
    let notification = Notification::DirectMessage(DirectMessageNotification {
        sender: Principal::from_text("cbopz-duaaa-aaaaa-qaaka-cai").unwrap().into(),
        thread_root_message_index: None,
        message_index: 1.into(),
        event_index: 1.into(),
        sender_name: "BlahBlah".to_string(),
        message_type: "text".to_string(),
        message_text: Some("abc".to_string()),
        image_url: None,
        sender_avatar_id: None,
        crypto_transfer: None,
    });

    let bytes = candid::encode_one(notification).unwrap().len();

    assert!(bytes < 600, "{bytes}");
}
