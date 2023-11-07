use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub them: UserId,
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
