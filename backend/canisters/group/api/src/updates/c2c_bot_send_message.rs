use crate::send_message_v2;
use serde::{Deserialize, Serialize};
use types::{BotInitiator, BotMessageContent, MessageId, MessageIndex, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: BotMessageContent,
    pub bot_name: String,
    pub block_level_markdown: bool,
    pub finalised: bool,
}

impl From<Args> for send_message_v2::Args {
    fn from(value: Args) -> Self {
        send_message_v2::Args {
            thread_root_message_index: value.thread_root_message_index,
            message_id: value.message_id,
            content: value.content.into(),
            sender_name: value.bot_name,
            sender_display_name: None,
            replies_to: None,
            mentioned: vec![],
            forwarding: false,
            block_level_markdown: value.block_level_markdown,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
        }
    }
}

pub type Response = send_message_v2::Response;
