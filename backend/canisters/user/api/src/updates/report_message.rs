use candid::CandidType;
use ts_export::ts_export;
use types::{MessageId, MessageIndex, UserId};

#[ts_export(user, report_message)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub them: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub delete: bool,
}

#[ts_export(user, report_message)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    UserSuspended,
    ChatNotFound,
    MessageNotFound,
    AlreadyReported,
    InternalError(String),
}
