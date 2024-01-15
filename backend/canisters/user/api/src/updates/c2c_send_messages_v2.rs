use chat_events::MessageContentInternal;
use serde::{Deserialize, Serialize};
use types::{Chat, EventIndex, MessageId, MessageIndex};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub messages: Vec<SendMessageArgs>,
    pub sender_name: String,
    pub sender_display_name: Option<String>,
    pub sender_avatar_id: Option<u128>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SendMessageArgs {
    pub message_id: MessageId,
    pub sender_message_index: MessageIndex,
    pub content: MessageContentInternal,
    pub replies_to: Option<C2CReplyContext>,
    pub forwarding: bool,
    #[serde(default)]
    pub message_filter_failed: Option<u64>,
    #[serde(default)]
    pub correlation_id: u64,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Blocked,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum C2CReplyContext {
    ThisChat(MessageId),
    OtherChat(Chat, Option<MessageIndex>, EventIndex),
}
