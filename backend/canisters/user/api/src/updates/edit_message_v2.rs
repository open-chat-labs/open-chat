use candid::CandidType;
use ts_export::ts_export;
use types::{MessageContentInitial, MessageId, MessageIndex, UserId};

#[ts_export(user, edit_message)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInitial,
    pub block_level_markdown: Option<bool>,
    pub correlation_id: u64,
}

#[ts_export(user, edit_message)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    ChatNotFound,
    UserBlocked,
    UserSuspended,
}
