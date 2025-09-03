use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageContent, MessageId, UserId};

#[ts_export(user, deleted_message)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_id: MessageId,
}

#[expect(clippy::large_enum_variant)]
#[ts_export(user, deleted_message)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(user, deleted_message)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub content: MessageContent,
}
