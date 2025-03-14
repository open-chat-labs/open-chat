use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageContent, MessageId, UserId};

#[ts_export(user, deleted_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_id: MessageId,
}

#[allow(clippy::large_enum_variant)]
#[ts_export(user, deleted_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    ChatNotFound,
    NotAuthorized,
    MessageNotFound,
    MessageHardDeleted,
    Error(u16, Option<String>),
}

#[ts_export(user, deleted_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub content: MessageContent,
}
