use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotChatContext, BotMessageContent, MessageId, MessageIndex, OgPreview, UnitResult};

// A bot edits its own messages autonomously, in a group or channel
#[ts_export(local_user_index, bot_edit_message)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub chat_context: BotChatContext,
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: BotMessageContent,
    pub block_level_markdown: bool,
    pub og_previews: Option<Vec<OgPreview>>,
}

pub type Response = UnitResult;
