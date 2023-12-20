use chat_events::MessageContentInternal;
use serde::{Deserialize, Serialize};
use types::{GroupReplyContext, MessageId, MessageIndex, User, Version};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInternal,
    pub sender_name: String,
    pub sender_display_name: Option<String>,
    pub replies_to: Option<GroupReplyContext>,
    pub mentioned: Vec<User>,
    pub forwarding: bool,
    pub rules_accepted: Option<Version>,
    #[serde(default)]
    pub message_filter_failed: Option<u64>,
    pub correlation_id: u64,
}

pub type Response = crate::send_message_v2::Response;
