use crate::{
    BotDataEncoding, BotInstallationLocation, BotPermissions, CanisterId, ChannelId, Chat, ChatEvent, ChatId, CommunityEvent,
    CommunityId, EventIndex, FcmData, MessageIndex, Reaction, TimestampMillis, UserId,
};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::{
    collections::HashMap,
    fmt::{Debug, Formatter},
};
use ts_export::ts_export;

#[allow(clippy::large_enum_variant)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum Notification {
    #[serde(rename = "u")]
    User(UserNotification),
    #[serde(rename = "b")]
    Bot(BotNotification),
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(from = "UserNotificationCombined")]
pub struct UserNotification {
    #[serde(rename = "s")]
    pub sender: Option<UserId>,
    #[serde(rename = "r")]
    pub recipients: Vec<UserId>,
    #[serde(rename = "n2")]
    pub notification: UserNotificationPayload,
}

#[derive(Deserialize)]
pub struct UserNotificationCombined {
    #[serde(rename = "s")]
    pub sender: Option<UserId>,
    #[serde(rename = "r")]
    pub recipients: Vec<UserId>,
    #[serde(rename = "n")]
    pub notification_bytes: Option<ByteBuf>,
    #[serde(rename = "n2")]
    pub notification: Option<UserNotificationPayload>,
}

impl From<UserNotificationCombined> for UserNotification {
    fn from(value: UserNotificationCombined) -> Self {
        UserNotification {
            sender: value.sender,
            recipients: value.recipients,
            notification: value
                .notification
                .unwrap_or_else(|| msgpack::deserialize_then_unwrap(&value.notification_bytes.unwrap())),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BotNotification {
    #[serde(rename = "e")]
    pub event: BotEvent,
    #[serde(rename = "r")]
    pub recipients: Vec<UserId>,
    #[serde(default, rename = "t")]
    pub timestamp: TimestampMillis,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum BotEvent {
    #[serde(alias = "c")]
    Chat(BotChatEvent),
    #[serde(alias = "u")]
    Community(BotCommunityEvent),
    #[serde(alias = "l")]
    Lifecycle(BotLifecycleEvent),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BotEventWrapper {
    #[serde(alias = "g")]
    pub api_gateway: CanisterId,
    #[serde(alias = "e")]
    pub event: BotEvent,
    #[serde(alias = "t")]
    pub timestamp: TimestampMillis,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BotChatEvent {
    #[serde(alias = "v")]
    pub event: ChatEvent,
    #[serde(alias = "c")]
    pub chat: Chat,
    #[serde(alias = "t")]
    pub thread: Option<MessageIndex>,
    #[serde(alias = "i")]
    pub event_index: EventIndex,
    #[serde(alias = "l")]
    pub latest_event_index: EventIndex,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BotCommunityEvent {
    #[serde(alias = "e")]
    pub event: CommunityEvent,
    #[serde(alias = "c")]
    pub community_id: CommunityId,
    #[serde(alias = "i")]
    pub event_index: EventIndex,
    #[serde(alias = "l")]
    pub latest_event_index: EventIndex,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum BotLifecycleEvent {
    #[serde(alias = "r")]
    Registered(BotRegisteredEvent),
    #[serde(alias = "i")]
    Installed(BotInstalledEvent),
    #[serde(alias = "u")]
    Uninstalled(BotUninstalledEvent),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BotInstalledEvent {
    #[serde(alias = "u")]
    pub installed_by: UserId,
    #[serde(alias = "l")]
    pub location: BotInstallationLocation,
    #[serde(alias = "p")]
    pub granted_command_permissions: BotPermissions,
    #[serde(alias = "a")]
    pub granted_autonomous_permissions: BotPermissions,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BotUninstalledEvent {
    #[serde(alias = "u")]
    pub uninstalled_by: UserId,
    #[serde(alias = "l")]
    pub location: BotInstallationLocation,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BotRegisteredEvent {
    #[serde(alias = "i")]
    pub bot_id: UserId,
    #[serde(alias = "n")]
    pub bot_name: String,
}

impl Debug for UserNotification {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("UserNotification")
            .field("sender", &self.sender)
            .field("recipients", &self.recipients)
            .finish()
    }
}

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
    #[serde(rename = "f")]
    pub fcm_data: Option<FcmData>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BotNotificationEnvelope {
    #[serde(rename = "r")]
    pub recipients: HashMap<UserId, BotDataEncoding>,
    #[serde(rename = "n")]
    pub notification_bytes: HashMap<BotDataEncoding, ByteBuf>,
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
#[derive(Serialize, Deserialize, Clone)]
pub enum UserNotificationPayload {
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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Payload {
    pub data: ByteBuf,
    pub mime_type: String,
}

impl Payload {
    pub fn new(data: ByteBuf, mime_type: &str) -> Self {
        Self {
            data,
            mime_type: mime_type.to_string(),
        }
    }
}
