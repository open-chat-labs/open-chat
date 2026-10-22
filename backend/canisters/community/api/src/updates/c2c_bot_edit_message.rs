use serde::{Deserialize, Serialize};
use types::{BotInitiator, BotMessageContent, ChannelId, MessageId, MessageIndex, OgPreview, UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub channel_id: ChannelId,
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: BotMessageContent,
    pub block_level_markdown: bool,
    #[serde(default)]
    pub og_previews: Vec<OgPreview>,
}

pub type Response = UnitResult;
