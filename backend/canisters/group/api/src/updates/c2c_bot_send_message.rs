use crate::send_message_v2;
use serde::{Deserialize, Serialize};
use types::{
    BotInitiator, BotMessageContent, BridgedUser, EventIndex, GroupReplyContext, MessageId, MessageIndex, OgPreview, UserId,
};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub replies_to: Option<EventIndex>,
    pub content: BotMessageContent,
    pub bot_name: String,
    pub block_level_markdown: bool,
    pub finalised: bool,
    #[serde(default)]
    pub og_previews: Vec<OgPreview>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bridged_from: Option<BridgedUser>,
}

impl From<Args> for send_message_v2::Args {
    fn from(value: Args) -> Self {
        send_message_v2::Args {
            thread_root_message_index: value.thread_root_message_index,
            message_id: value.message_id,
            content: value.content.into(),
            sender_name: value.bot_name,
            // So that notifications of a message relayed from another platform show its author there
            sender_display_name: value.bridged_from.map(|b| b.into_notification_display_name()),
            replies_to: value.replies_to.map(|r| GroupReplyContext { event_index: r }),
            mentioned: vec![],
            forwarding: false,
            block_level_markdown: value.block_level_markdown,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            og_previews: value.og_previews,
        }
    }
}

pub type Response = send_message_v2::Response;
