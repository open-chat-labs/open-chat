use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotChatContext, BotMessageContent, MessageId, MessageIndex};

#[ts_export(local_user_index, bot_send_message_v2)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub chat_context: BotChatContext,
    pub thread: Option<MessageIndex>,
    pub message_id: Option<MessageId>,
    pub content: BotMessageContent,
    pub block_level_markdown: bool,
    pub finalised: bool,
}

pub type Response = crate::bot_send_message::Response;
