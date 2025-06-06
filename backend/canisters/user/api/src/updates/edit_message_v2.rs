use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageContentInitial, MessageId, MessageIndex, UnitResult, UserId};

#[ts_export(user, edit_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInitial,
    pub block_level_markdown: Option<bool>,
}

pub type Response = UnitResult;
