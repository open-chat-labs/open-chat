use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::fmt::{Debug, Formatter};
use types::{CanisterId, Chat, ChatEventType, EventIndex, IdempotentEnvelope, MessageIndex, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    #[serde(rename = "n")]
    pub notifications: Vec<IdempotentEnvelope<Notification>>,
    #[serde(rename = "a")]
    pub authorizer: Option<CanisterId>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Notification {
    #[serde(rename = "u")]
    User(UserNotification),
    #[serde(rename = "b")]
    Bot(BotNotification),
}

#[derive(Serialize, Deserialize)]
pub struct UserNotification {
    #[serde(rename = "s")]
    pub sender: Option<UserId>,
    #[serde(rename = "r")]
    pub recipients: Vec<UserId>,
    #[serde(rename = "n")]
    pub notification_bytes: ByteBuf,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct BotNotification {
    #[serde(rename = "e")]
    pub event_type: ChatEventType,
    #[serde(rename = "r")]
    pub recipients: Vec<UserId>,
    #[serde(rename = "c")]
    pub chat: Chat,
    #[serde(rename = "t")]
    pub thread: Option<MessageIndex>,
    #[serde(rename = "i")]
    pub event_index: EventIndex,
    #[serde(rename = "l")]
    pub latest_event_index: EventIndex,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Blocked,
    InternalError(String),
}

impl Debug for UserNotification {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("UserNotification")
            .field("sender", &self.sender)
            .field("recipients", &self.recipients)
            .field("notification_bytes_length", &self.notification_bytes.len())
            .finish()
    }
}
