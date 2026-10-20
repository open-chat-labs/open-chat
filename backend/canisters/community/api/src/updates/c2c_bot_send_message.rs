use crate::send_message;
use serde::{Deserialize, Serialize};
use types::{
    BotInitiator, BotMessageContent, ChannelId, DiscordMessageContext, EventIndex, GroupReplyContext, MessageId, MessageIndex,
    OgPreview, UserId,
};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub channel_id: ChannelId,
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
    pub discord: Option<DiscordMessageContext>,
}

impl From<Args> for send_message::Args {
    fn from(value: Args) -> Self {
        send_message::Args {
            channel_id: value.channel_id,
            thread_root_message_index: value.thread_root_message_index,
            message_id: value.message_id,
            content: value.content.into(),
            sender_name: value.bot_name,
            // So that notifications of a message relayed from Discord show its Discord author
            sender_display_name: value.discord.map(|d| d.author.into_display_name()),
            replies_to: value.replies_to.map(|r| GroupReplyContext { event_index: r }),
            mentioned: vec![],
            forwarding: false,
            block_level_markdown: value.block_level_markdown,
            community_rules_accepted: None,
            channel_rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            og_previews: value.og_previews,
        }
    }
}

pub type Response = send_message::Response;
