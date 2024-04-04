use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageId, MessageIndex, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub them: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub delete: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserSuspended,
    ChatNotFound,
    MessageNotFound,
    AlreadyReported,
    InternalError(String),
}
