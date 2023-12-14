use chat_events::MessageContentInternal;
use serde::{Deserialize, Serialize};
use types::{MessageContentInitial, MessageId, MessageIndex};

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
    pub replies_to: Option<crate::c2c_send_messages::C2CReplyContext>,
    pub forwarding: bool,
    #[serde(default)]
    pub message_filter_failed: Option<u64>,
    pub correlation_id: u64,
}

pub type Response = crate::c2c_send_messages::Response;

impl From<crate::c2c_send_messages::SendMessageArgs> for SendMessageArgs {
    fn from(value: crate::c2c_send_messages::SendMessageArgs) -> Self {
        SendMessageArgs {
            message_id: value.message_id,
            sender_message_index: value.sender_message_index,
            content: MessageContentInitial::from(value.content).try_into().unwrap(),
            replies_to: value.replies_to,
            forwarding: value.forwarding,
            message_filter_failed: value.message_filter_failed,
            correlation_id: value.correlation_id,
        }
    }
}
