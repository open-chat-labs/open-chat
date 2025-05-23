use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotChatContext, MessageId, MessageIndex, UnitResult};

#[ts_export(local_user_index, bot_delete_messages_v2)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub chat_context: BotChatContext,
    pub thread: Option<MessageIndex>,
    pub message_ids: Vec<MessageId>,
}

pub type Response = UnitResult;
