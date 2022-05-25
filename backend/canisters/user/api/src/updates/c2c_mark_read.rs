use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::MessageIndexRange;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_ranges: Vec<MessageIndexRange>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    SuccessNoChange,
    ChatNotFound,
}
