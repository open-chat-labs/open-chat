use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageContent, MessageId, MessageIndex};

#[ts_export(group, deleted_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

#[ts_export(group, deleted_message)]
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
    NotAuthorized,
    MessageNotFound,
    MessageHardDeleted,
}

#[ts_export(group, deleted_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub content: MessageContent,
}
