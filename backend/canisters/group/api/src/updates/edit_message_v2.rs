use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageContentInitial, MessageId, MessageIndex};

#[ts_export(group, edit_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInitial,
    pub block_level_markdown: Option<bool>,
    pub new_achievement: bool,
    pub correlation_id: u64,
}

#[ts_export(group, edit_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    CallerNotInGroup,
    UserSuspended,
    UserLapsed,
    ChatFrozen,
    Error(u16, Option<String>),
}
