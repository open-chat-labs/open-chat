use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::MessageId;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct Args {
    pub message_id: MessageId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    AlreadyEnded,
    Error(OCError),
}
