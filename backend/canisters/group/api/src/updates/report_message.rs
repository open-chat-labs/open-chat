use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::MessageId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub reason_code: u32,
    pub notes: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ChatFrozen,
    CallerNotInGroup,
    MessageNotFound,
    InternalError(String),
}
