use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{EmptySuccessOrError, MessageId, MessageIndex, UserId};

#[ts_export(user, report_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub them: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub delete: bool,
}

pub type Response = EmptySuccessOrError;
