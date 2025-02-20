use crate::{CanisterId, ChannelId, ChatId, CommunityId, EventIndex, MessageIndex, Reaction, TimestampMillis, UserId};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::fmt::{Debug, Formatter};
use ts_export::ts_export;

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct NotificationEnvelope {
    #[serde(rename = "r")]
    pub recipients: Vec<UserId>,
    #[serde(rename = "n")]
    pub notification_bytes: ByteBuf,
    #[serde(rename = "t")]
    pub timestamp: TimestampMillis,
}

const CANISTER_PRINCIPAL_LEN: usize = 10;

impl NotificationEnvelope {
    pub fn approx_size(&self) -> usize {
        CANISTER_PRINCIPAL_LEN * self.recipients.len() + self.notification_bytes.len() + 7
    }
}

#[ts_export]
#[derive(Serialize)]
pub enum Notification {
    AddedToChannel(AddedToChannelNotification),
    DirectMessage(DirectMessageNotification),
    GroupMessage(GroupMessageNotification),
    ChannelMessage(ChannelMessageNotification),
    DirectReactionAdded(DirectReactionAddedNotification),
    GroupReactionAdded(GroupReactionAddedNotification),
    ChannelReactionAdded(ChannelReactionAddedNotification),
    DirectMessageTipped(DirectMessageTipped),
    GroupMessageTipped(GroupMessageTipped),
    ChannelMessageTipped(ChannelMessageTipped),
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AddedToChannelNotification {
    pub community_id: CommunityId,
    pub community_name: String,
    pub channel_id: ChannelId,
    pub channel_name: String,
    pub added_by: UserId,
    pub added_by_name: String,
    pub added_by_display_name: Option<String>,
    pub community_avatar_id: Option<u128>,
    pub channel_avatar_id: Option<u128>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DirectMessageNotification {
    pub sender: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub event_index: EventIndex,
    pub sender_name: String,
    pub sender_display_name: Option<String>,
    pub message_type: String,
    pub message_text: Option<String>,
    pub image_url: Option<String>,
    pub sender_avatar_id: Option<u128>,
    pub crypto_transfer: Option<CryptoTransferDetails>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupMessageNotification {
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub event_index: EventIndex,
    pub group_name: String,
    pub sender: UserId,
    pub sender_name: String,
    pub sender_display_name: Option<String>,
    pub message_type: String,
    pub message_text: Option<String>,
    pub image_url: Option<String>,
    pub group_avatar_id: Option<u128>,
    pub crypto_transfer: Option<CryptoTransferDetails>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
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
    pub sender_display_name: Option<String>,
    pub message_type: String,
    pub message_text: Option<String>,
    pub image_url: Option<String>,
    pub community_avatar_id: Option<u128>,
    pub channel_avatar_id: Option<u128>,
    pub crypto_transfer: Option<CryptoTransferDetails>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DirectReactionAddedNotification {
    pub them: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_event_index: EventIndex,
    pub username: String,
    pub display_name: Option<String>,
    pub reaction: Reaction,
    pub user_avatar_id: Option<u128>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupReactionAddedNotification {
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_event_index: EventIndex,
    pub group_name: String,
    pub added_by: UserId,
    pub added_by_name: String,
    pub added_by_display_name: Option<String>,
    pub reaction: Reaction,
    pub group_avatar_id: Option<u128>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
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
    pub added_by_display_name: Option<String>,
    pub reaction: Reaction,
    pub community_avatar_id: Option<u128>,
    pub channel_avatar_id: Option<u128>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DirectMessageTipped {
    pub them: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_event_index: EventIndex,
    pub username: String,
    pub display_name: Option<String>,
    pub tip: String, // formatted amount, eg. "0.1 CHAT"
    pub user_avatar_id: Option<u128>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupMessageTipped {
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_event_index: EventIndex,
    pub group_name: String,
    pub tipped_by: UserId,
    pub tipped_by_name: String,
    pub tipped_by_display_name: Option<String>,
    pub tip: String,
    pub group_avatar_id: Option<u128>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChannelMessageTipped {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_event_index: EventIndex,
    pub community_name: String,
    pub channel_name: String,
    pub tipped_by: UserId,
    pub tipped_by_name: String,
    pub tipped_by_display_name: Option<String>,
    pub tip: String,
    pub community_avatar_id: Option<u128>,
    pub channel_avatar_id: Option<u128>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
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
        sender_display_name: None,
        message_type: "text".to_string(),
        message_text: Some("abc".to_string()),
        image_url: None,
        sender_avatar_id: None,
        crypto_transfer: None,
    });

    let bytes = candid::encode_one(notification).unwrap().len();

    assert!(bytes < 850, "{bytes}");
}
