use crate::{
    BotDataEncoding, BotEventPayload, BotInstallationLocation, BotPermissions, CanisterId, ChannelId, Chat, ChatEvent, ChatId,
    CommunityEvent, CommunityId, EventIndex, FcmData, MessageId, MessageIndex, Reaction, TimestampMillis, UserId,
    VideoCallType,
};
use candid::{CandidType, Principal};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::{
    collections::HashMap,
    fmt::{Debug, Formatter},
};
use subenum::subenum;
use ts_export::ts_export;

#[allow(clippy::large_enum_variant)]
#[derive(Serialize, Deserialize, Clone)]
#[serde(bound = "T: Serialize + DeserializeOwned")]
pub enum Notification<T = UserNotificationPayload> {
    #[serde(rename = "u")]
    User(UserNotification<T>),
    #[serde(rename = "b")]
    Bot(BotNotification),
}

impl<T> Debug for Notification<T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Notification::User(u) => Formatter::debug_tuple(f, "User").field(u).finish(),
            Notification::Bot(b) => Formatter::debug_tuple(f, "Bot").field(b).finish(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(bound = "T: Serialize + DeserializeOwned")]
pub struct UserNotification<T = UserNotificationPayload> {
    #[serde(rename = "s")]
    pub sender: Option<UserId>,
    #[serde(rename = "r")]
    pub recipients: Vec<UserId>,
    #[serde(rename = "n2")]
    pub notification: T,
}

// The most recipients a single notification is sent to
const MAX_RECIPIENTS_PER_USER_NOTIFICATION: usize = 5_000;

impl<T: Clone> UserNotification<T> {
    // A notification in a large chat can have as many recipients as the chat has members (eg. an
    // @everyone mention), so it is split into several, each with a bounded number of recipients,
    // so that the size of a call carrying them doesn't grow with the size of the chat
    pub fn split_by_recipients(sender: Option<UserId>, mut recipients: Vec<UserId>, notification: T) -> Vec<Self> {
        let mut notifications = Vec::new();
        while recipients.len() > MAX_RECIPIENTS_PER_USER_NOTIFICATION {
            let remaining = recipients.split_off(MAX_RECIPIENTS_PER_USER_NOTIFICATION);
            notifications.push(UserNotification {
                sender,
                recipients,
                notification: notification.clone(),
            });
            recipients = remaining;
        }
        if !recipients.is_empty() {
            notifications.push(UserNotification {
                sender,
                recipients,
                notification,
            });
        }
        notifications
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

impl<T> Debug for UserNotification<T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("UserNotification")
            .field("sender", &self.sender)
            .field("recipients", &self.recipients)
            .finish()
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum NotificationEnvelope {
    User(Box<UserNotificationEnvelope>),
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
    #[serde(rename = "e")]
    pub event_map: HashMap<BotDataEncoding, BotEventPayload>,
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
#[subenum(
    DirectChatUserNotificationPayload,
    GroupChatUserNotificationPayload,
    ChannelUserNotificationPayload
)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum UserNotificationPayload {
    #[subenum(ChannelUserNotificationPayload)]
    #[serde(rename = "ac")]
    AddedToChannel(AddedToChannelNotification),
    #[subenum(DirectChatUserNotificationPayload)]
    #[serde(rename = "dm")]
    DirectMessage(DirectMessageNotification),
    #[subenum(GroupChatUserNotificationPayload)]
    #[serde(rename = "gm")]
    GroupMessage(GroupMessageNotification),
    #[subenum(ChannelUserNotificationPayload)]
    #[serde(rename = "cm")]
    ChannelMessage(ChannelMessageNotification),
    #[subenum(DirectChatUserNotificationPayload)]
    #[serde(rename = "dr")]
    DirectReactionAdded(DirectReactionAddedNotification),
    #[subenum(GroupChatUserNotificationPayload)]
    #[serde(rename = "gr")]
    GroupReactionAdded(GroupReactionAddedNotification),
    #[subenum(ChannelUserNotificationPayload)]
    #[serde(rename = "cr")]
    ChannelReactionAdded(ChannelReactionAddedNotification),
    #[subenum(DirectChatUserNotificationPayload)]
    #[serde(rename = "dt")]
    DirectMessageTipped(DirectMessageTipped),
    #[subenum(GroupChatUserNotificationPayload)]
    #[serde(rename = "gt")]
    GroupMessageTipped(GroupMessageTipped),
    #[subenum(ChannelUserNotificationPayload)]
    #[serde(rename = "ct")]
    ChannelMessageTipped(ChannelMessageTipped),
    // A ring for the named call should stop. Never shown to the user.
    #[subenum(DirectChatUserNotificationPayload)]
    #[serde(rename = "dcd")]
    DirectCallDismissed(DirectCallDismissedNotification),
    #[subenum(GroupChatUserNotificationPayload)]
    #[serde(rename = "gcd")]
    GroupCallDismissed(GroupCallDismissedNotification),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, Eq, PartialEq)]
pub struct CallFacts {
    #[serde(rename = "id")]
    pub message_id: MessageId,
    #[serde(rename = "ct")]
    pub call_type: VideoCallType,
    #[serde(rename = "ao", default)]
    #[ts(as = "Option<bool>", optional)]
    pub audio_only: bool,
    #[serde(rename = "st")]
    pub started: TimestampMillis,
    #[serde(rename = "pb")]
    pub is_public: bool,
    #[serde(rename = "mc")]
    pub member_count: u32,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, Eq, PartialEq)]
pub enum CallDismissalKind {
    // The call ended before this user joined it
    Ended,
    // This user joined the call, perhaps on another device
    AnsweredElsewhere,
    /// This user declined the call, perhaps on another device
    DeclinedElsewhere,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DirectCallDismissedNotification {
    #[serde(rename = "u")]
    pub them: UserId,
    #[serde(rename = "id")]
    pub message_id: MessageId,
    #[serde(rename = "k")]
    pub kind: CallDismissalKind,
}

#[ts_export]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupCallDismissedNotification {
    #[serde(rename = "c")]
    pub chat_id: ChatId,
    #[serde(rename = "id")]
    pub message_id: MessageId,
    #[serde(rename = "k")]
    pub kind: CallDismissalKind,
    // So the local user index can apply the same ring policy it applied to the start
    #[serde(rename = "pb")]
    pub is_public: bool,
    #[serde(rename = "mc")]
    pub member_count: u32,
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
    #[serde(rename = "fn", default)]
    pub file_name: Option<String>,
    #[serde(rename = "a")]
    pub sender_avatar_id: Option<u128>,
    #[serde(rename = "ct")]
    pub crypto_transfer: Option<CryptoTransferDetails>,
    // Present when the message is a call start. What the local user index needs to decide
    // whether the recipient's phone rings. Facts only: the fleet holds no ring policy.
    #[serde(rename = "vc", default)]
    #[ts(optional)]
    pub call: Option<CallFacts>,
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
    #[serde(rename = "fn", default)]
    pub file_name: Option<String>,
    #[serde(rename = "a")]
    pub group_avatar_id: Option<u128>,
    #[serde(rename = "ct")]
    pub crypto_transfer: Option<CryptoTransferDetails>,
    // Present when the message is a call start. What the local user index needs to decide
    // whether the recipient's phone rings. Facts only: the fleet holds no ring policy.
    #[serde(rename = "vc", default)]
    #[ts(optional)]
    pub call: Option<CallFacts>,
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
    #[serde(rename = "fn", default)]
    pub file_name: Option<String>,
    #[serde(rename = "ca")]
    pub community_avatar_id: Option<u128>,
    #[serde(rename = "cha")]
    pub channel_avatar_id: Option<u128>,
    #[serde(rename = "ct")]
    pub crypto_transfer: Option<CryptoTransferDetails>,
    // Present when the message is a call start. What the local user index needs to decide
    // whether the recipient's phone rings. Facts only: the fleet holds no ring policy.
    #[serde(rename = "vc", default)]
    #[ts(optional)]
    pub call: Option<CallFacts>,
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

#[cfg(test)]
mod split_by_recipients_tests {
    use super::*;

    const MAX: usize = MAX_RECIPIENTS_PER_USER_NOTIFICATION;

    #[test]
    fn each_recipient_is_in_exactly_one_notification() {
        for (count, expected_sizes) in [
            (0, vec![]),
            (1, vec![1]),
            (MAX, vec![MAX]),
            (MAX + 1, vec![MAX, 1]),
            (3 * MAX, vec![MAX, MAX, MAX]),
        ] {
            let sender: UserId = Principal::from_slice(&[0]).into();
            let recipients: Vec<UserId> = (1..=count as u32)
                .map(|i| Principal::from_slice(&i.to_be_bytes()).into())
                .collect();

            let notifications = UserNotification::split_by_recipients(Some(sender), recipients.clone(), "payload");

            let sizes: Vec<_> = notifications.iter().map(|n| n.recipients.len()).collect();
            assert_eq!(sizes, expected_sizes);
            assert!(
                notifications
                    .iter()
                    .all(|n| n.sender == Some(sender) && n.notification == "payload")
            );
            let all_recipients: Vec<_> = notifications.into_iter().flat_map(|n| n.recipients).collect();
            assert_eq!(all_recipients, recipients);
        }
    }
}

#[cfg(test)]
mod call_facts_tests {
    use super::*;
    use candid::Principal;

    // DirectMessageNotification exactly as the previous release held it. Frozen on purpose.
    #[derive(Serialize, Deserialize)]
    #[allow(dead_code)]
    struct PreviousDirectMessageNotification {
        #[serde(rename = "s")]
        sender: UserId,
        #[serde(rename = "tr")]
        thread_root_message_index: Option<MessageIndex>,
        #[serde(rename = "m")]
        message_index: MessageIndex,
        #[serde(rename = "e")]
        event_index: EventIndex,
        #[serde(rename = "sn")]
        sender_name: String,
        #[serde(rename = "sd")]
        sender_display_name: Option<String>,
        #[serde(rename = "ty")]
        message_type: String,
        #[serde(rename = "tx")]
        message_text: Option<String>,
        #[serde(rename = "i")]
        image_url: Option<String>,
        #[serde(rename = "fn", default)]
        file_name: Option<String>,
        #[serde(rename = "a")]
        sender_avatar_id: Option<u128>,
        #[serde(rename = "ct")]
        crypto_transfer: Option<CryptoTransferDetails>,
    }

    // #9456 invariant 8: a message notification carrying the call facts block decodes with the
    // previous release's type, so a canister on this release can talk to a local user index
    // on the previous one. It holds because the inter-canister encoding is a named map.
    #[test]
    fn invariant_8_a_start_notification_with_call_facts_decodes_with_the_previous_type() {
        let sender: UserId = Principal::from_slice(&[1]).into();
        let new = DirectMessageNotification {
            sender,
            thread_root_message_index: None,
            message_index: 3.into(),
            event_index: EventIndex::from(4),
            sender_name: "a".to_string(),
            sender_display_name: None,
            message_type: "VideoCall".to_string(),
            message_text: None,
            image_url: None,
            file_name: None,
            sender_avatar_id: None,
            crypto_transfer: None,
            call: Some(CallFacts {
                message_id: 7u64.into(),
                call_type: VideoCallType::Default,
                audio_only: false,
                started: 1000,
                is_public: false,
                member_count: 2,
            }),
        };
        let bytes = msgpack::serialize_then_unwrap(&new);
        let previous: PreviousDirectMessageNotification = msgpack::deserialize_then_unwrap(&bytes);
        assert_eq!(previous.sender, sender);
        assert_eq!(previous.message_type, "VideoCall");
    }

    // #9456 invariant 13: a message notification encoded by the previous release decodes with
    // this release's type. The local user index is released before the fleet, so for a while
    // every notification it receives is in the old shape, and one that failed to decode would
    // fail its whole batch.
    #[test]
    fn invariant_13_a_start_notification_from_the_previous_release_decodes_with_the_new_type() {
        let sender: UserId = Principal::from_slice(&[1]).into();
        let previous = PreviousDirectMessageNotification {
            sender,
            thread_root_message_index: None,
            message_index: 3.into(),
            event_index: EventIndex::from(4),
            sender_name: "a".to_string(),
            sender_display_name: None,
            message_type: "VideoCall".to_string(),
            message_text: None,
            image_url: None,
            file_name: None,
            sender_avatar_id: None,
            crypto_transfer: None,
        };
        let bytes = msgpack::serialize_then_unwrap(&previous);
        let new: DirectMessageNotification = msgpack::deserialize_then_unwrap(&bytes);
        assert_eq!(new.sender, sender);
        assert!(new.call.is_none());
    }
}
