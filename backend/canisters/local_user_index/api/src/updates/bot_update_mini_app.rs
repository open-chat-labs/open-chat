use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotChatContext, MessageId, MessageIndex, MiniAppUpdate, UnitResult};

// A bot changes what its MiniApp card shows as its game goes on, in a group or channel
#[ts_export(local_user_index, bot_update_mini_app)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub chat_context: BotChatContext,
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
    pub update: MiniAppUpdate,
}

pub type Response = UnitResult;
