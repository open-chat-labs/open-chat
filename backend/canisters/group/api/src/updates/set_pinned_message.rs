use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::MessageIndex;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_index: Option<MessageIndex>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NoChange,
    MessageIndexOutOfRange,
    NotAuthorized,
    CallerNotInGroup,
}
