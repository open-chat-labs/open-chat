use serde::{Deserialize, Serialize};
use types::{BotInitiator, BotMessageContent, MessageId, MessageIndex, OgPreview, UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: BotMessageContent,
    pub block_level_markdown: bool,
    #[serde(default)]
    pub og_previews: Vec<OgPreview>,
}

pub type Response = UnitResult;
