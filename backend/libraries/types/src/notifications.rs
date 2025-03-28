use crate::{
    CanisterId, ChannelId, Chat, ChatEventType, ChatId, CommunityId, EventIndex, MessageIndex, Reaction, TimestampMillis,
    UserId,
};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::fmt::{Debug, Formatter};
use ts_export::ts_export;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum NotificationEnvelope {
    User(UserNotificationEnvelope),
    Bot(BotNotificationEnvelope),
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct UserNotificationEnvelope {
    #[serde(rename = "r")]
    pub recipients: Vec<UserId>,
    #[serde(rename = "n")]
    pub notification_bytes: ByteBuf,
    #[serde(rename = "t")]
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BotNotificationEnvelope {
    #[serde(rename = "ty")]
    pub event_type: ChatEventType,
    #[serde(rename = "r")]
    pub recipients: Vec<UserId>,
    #[serde(rename = "c")]
    pub chat: Chat,
    #[serde(rename = "th")]
    pub thread: Option<MessageIndex>,
    #[serde(rename = "i")]
    pub event_index: EventIndex,
    #[serde(rename = "l")]
    pub latest_event_index: EventIndex,
    #[serde(rename = "t")]
    pub timestamp: TimestampMillis,
}

const CANISTER_PRINCIPAL_LEN: usize = 10;

impl NotificationEnvelope {
    pub fn approx_size(&self) -> usize {
        match self {
            NotificationEnvelope::User(n) => n.approx_size(),
            NotificationEnvelope::Bot(n) => n.approx_size(),
        }
    }
}

impl UserNotificationEnvelope {
    pub fn approx_size(&self) -> usize {
        CANISTER_PRINCIPAL_LEN * self.recipients.len() + self.notification_bytes.len() + 7
    }
}

impl BotNotificationEnvelope {
    pub fn approx_size(&self) -> usize {
        125 + self.recipients.len() * CANISTER_PRINCIPAL_LEN
    }
}

#[ts_export]
#[derive(Serialize)]
pub enum Notification {
    #[serde(rename = "ac")]
    AddedToChannel(AddedToChannelNotification),
    #[serde(rename = "dm")]
    DirectMessage(DirectMessageNotification),
    #[serde(rename = "gm")]
    GroupMessage(GroupMessageNotification),
    #[serde(rename = "cm")]
    ChannelMessage(ChannelMessageNotification),
    #[serde(rename = "dr")]
    DirectReactionAdded(DirectReactionAddedNotification),
    #[serde(rename = "gr")]
    GroupReactionAdded(GroupReactionAddedNotification),
    #[serde(rename = "cr")]
    ChannelReactionAdded(ChannelReactionAddedNotification),
    #[serde(rename = "dt")]
    DirectMessageTipped(DirectMessageTipped),
    #[serde(rename = "gt")]
    GroupMessageTipped(GroupMessageTipped),
    #[serde(rename = "ct")]
    ChannelMessageTipped(ChannelMessageTipped),
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AddedToChannelNotification {
    #[serde(rename = "ci")]
    pub community_id: CommunityId,
    #[serde(rename = "cn")]
    pub community_name: String,
    #[serde(rename = "chi")]
    pub channel_id: ChannelId,
    #[serde(rename = "chn")]
    pub channel_name: String,
    #[serde(rename = "a")]
    pub added_by: UserId,
    #[serde(rename = "an")]
    pub added_by_name: String,
    #[serde(rename = "ad")]
    pub added_by_display_name: Option<String>,
    #[serde(rename = "ca")]
    pub community_avatar_id: Option<u128>,
    #[serde(rename = "cha")]
    pub channel_avatar_id: Option<u128>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DirectMessageNotification {
    #[serde(rename = "s")]
    pub sender: UserId,
    #[serde(rename = "tr")]
    pub thread_root_message_index: Option<MessageIndex>,
    #[serde(rename = "m")]
    pub message_index: MessageIndex,
    #[serde(rename = "e")]
    pub event_index: EventIndex,
    #[serde(rename = "sn")]
    pub sender_name: String,
    #[serde(rename = "sd")]
    pub sender_display_name: Option<String>,
    #[serde(rename = "ty")]
    pub message_type: String,
    #[serde(rename = "tx")]
    pub message_text: Option<String>,
    #[serde(rename = "i")]
    pub image_url: Option<String>,
    #[serde(rename = "a")]
    pub sender_avatar_id: Option<u128>,
    #[serde(rename = "ct")]
    pub crypto_transfer: Option<CryptoTransferDetails>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupMessageNotification {
    #[serde(rename = "c")]
    pub chat_id: ChatId,
    #[serde(rename = "tr")]
    pub thread_root_message_index: Option<MessageIndex>,
    #[serde(rename = "m")]
    pub message_index: MessageIndex,
    #[serde(rename = "e")]
    pub event_index: EventIndex,
    #[serde(rename = "g")]
    pub group_name: String,
    #[serde(rename = "s")]
    pub sender: UserId,
    #[serde(rename = "sn")]
    pub sender_name: String,
    #[serde(rename = "sd")]
    pub sender_display_name: Option<String>,
    #[serde(rename = "ty")]
    pub message_type: String,
    #[serde(rename = "tx")]
    pub message_text: Option<String>,
    #[serde(rename = "i")]
    pub image_url: Option<String>,
    #[serde(rename = "a")]
    pub group_avatar_id: Option<u128>,
    #[serde(rename = "ct")]
    pub crypto_transfer: Option<CryptoTransferDetails>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChannelMessageNotification {
    #[serde(rename = "ci")]
    pub community_id: CommunityId,
    #[serde(rename = "chi")]
    pub channel_id: ChannelId,
    #[serde(rename = "tr")]
    pub thread_root_message_index: Option<MessageIndex>,
    #[serde(rename = "m")]
    pub message_index: MessageIndex,
    #[serde(rename = "e")]
    pub event_index: EventIndex,
    #[serde(rename = "cn")]
    pub community_name: String,
    #[serde(rename = "chn")]
    pub channel_name: String,
    #[serde(rename = "s")]
    pub sender: UserId,
    #[serde(rename = "sn")]
    pub sender_name: String,
    #[serde(rename = "sd")]
    pub sender_display_name: Option<String>,
    #[serde(rename = "ty")]
    pub message_type: String,
    #[serde(rename = "tx")]
    pub message_text: Option<String>,
    #[serde(rename = "i")]
    pub image_url: Option<String>,
    #[serde(rename = "ca")]
    pub community_avatar_id: Option<u128>,
    #[serde(rename = "cha")]
    pub channel_avatar_id: Option<u128>,
    #[serde(rename = "ct")]
    pub crypto_transfer: Option<CryptoTransferDetails>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DirectReactionAddedNotification {
    #[serde(rename = "t")]
    pub them: UserId,
    #[serde(rename = "tr")]
    pub thread_root_message_index: Option<MessageIndex>,
    #[serde(rename = "m")]
    pub message_index: MessageIndex,
    #[serde(rename = "e")]
    pub message_event_index: EventIndex,
    #[serde(rename = "u")]
    pub username: String,
    #[serde(rename = "d")]
    pub display_name: Option<String>,
    #[serde(rename = "r")]
    pub reaction: Reaction,
    #[serde(rename = "a")]
    pub user_avatar_id: Option<u128>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupReactionAddedNotification {
    #[serde(rename = "c")]
    pub chat_id: ChatId,
    #[serde(rename = "tr")]
    pub thread_root_message_index: Option<MessageIndex>,
    #[serde(rename = "m")]
    pub message_index: MessageIndex,
    #[serde(rename = "e")]
    pub message_event_index: EventIndex,
    #[serde(rename = "g")]
    pub group_name: String,
    #[serde(rename = "a")]
    pub added_by: UserId,
    #[serde(rename = "n")]
    pub added_by_name: String,
    #[serde(rename = "d")]
    pub added_by_display_name: Option<String>,
    #[serde(rename = "r")]
    pub reaction: Reaction,
    #[serde(rename = "av")]
    pub group_avatar_id: Option<u128>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChannelReactionAddedNotification {
    #[serde(rename = "ci")]
    pub community_id: CommunityId,
    #[serde(rename = "chi")]
    pub channel_id: ChannelId,
    #[serde(rename = "tr")]
    pub thread_root_message_index: Option<MessageIndex>,
    #[serde(rename = "m")]
    pub message_index: MessageIndex,
    #[serde(rename = "e")]
    pub message_event_index: EventIndex,
    #[serde(rename = "cn")]
    pub community_name: String,
    #[serde(rename = "chn")]
    pub channel_name: String,
    #[serde(rename = "a")]
    pub added_by: UserId,
    #[serde(rename = "an")]
    pub added_by_name: String,
    #[serde(rename = "ad")]
    pub added_by_display_name: Option<String>,
    #[serde(rename = "r")]
    pub reaction: Reaction,
    #[serde(rename = "ca")]
    pub community_avatar_id: Option<u128>,
    #[serde(rename = "cha")]
    pub channel_avatar_id: Option<u128>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DirectMessageTipped {
    #[serde(rename = "ti")]
    pub them: UserId,
    #[serde(rename = "tr")]
    pub thread_root_message_index: Option<MessageIndex>,
    #[serde(rename = "m")]
    pub message_index: MessageIndex,
    #[serde(rename = "e")]
    pub message_event_index: EventIndex,
    #[serde(rename = "u")]
    pub username: String,
    #[serde(rename = "d")]
    pub display_name: Option<String>,
    #[serde(rename = "t")]
    pub tip: String, // formatted amount, eg. "0.1 CHAT"
    #[serde(rename = "a")]
    pub user_avatar_id: Option<u128>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupMessageTipped {
    #[serde(rename = "c")]
    pub chat_id: ChatId,
    #[serde(rename = "tr")]
    pub thread_root_message_index: Option<MessageIndex>,
    #[serde(rename = "m")]
    pub message_index: MessageIndex,
    #[serde(rename = "e")]
    pub message_event_index: EventIndex,
    #[serde(rename = "g")]
    pub group_name: String,
    #[serde(rename = "ti")]
    pub tipped_by: UserId,
    #[serde(rename = "tn")]
    pub tipped_by_name: String,
    #[serde(rename = "td")]
    pub tipped_by_display_name: Option<String>,
    #[serde(rename = "t")]
    pub tip: String,
    #[serde(rename = "a")]
    pub group_avatar_id: Option<u128>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChannelMessageTipped {
    #[serde(rename = "ci")]
    pub community_id: CommunityId,
    #[serde(rename = "chi")]
    pub channel_id: ChannelId,
    #[serde(rename = "tr")]
    pub thread_root_message_index: Option<MessageIndex>,
    #[serde(rename = "m")]
    pub message_index: MessageIndex,
    #[serde(rename = "e")]
    pub message_event_index: EventIndex,
    #[serde(rename = "cn")]
    pub community_name: String,
    #[serde(rename = "chn")]
    pub channel_name: String,
    #[serde(rename = "ti")]
    pub tipped_by: UserId,
    #[serde(rename = "tn")]
    pub tipped_by_name: String,
    #[serde(rename = "td")]
    pub tipped_by_display_name: Option<String>,
    #[serde(rename = "t")]
    pub tip: String,
    #[serde(rename = "ca")]
    pub community_avatar_id: Option<u128>,
    #[serde(rename = "cha")]
    pub channel_avatar_id: Option<u128>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CryptoTransferDetails {
    #[serde(rename = "r")]
    pub recipient: UserId,
    #[serde(rename = "u")]
    pub recipient_username: Option<String>,
    #[serde(rename = "l")]
    pub ledger: CanisterId,
    #[serde(rename = "s")]
    pub symbol: String,
    #[serde(rename = "a")]
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

impl Debug for UserNotificationEnvelope {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NotificationEnvelope")
            .field("recipients", &self.recipients.len())
            .field("notification_bytes", &self.notification_bytes.len())
            .field("timestamp", &self.timestamp)
            .finish()
    }
}
