use candid::CandidType;
use serde::Deserialize;
use types::MessageIndexRange;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub message_ranges: Vec<MessageIndexRange>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    SuccessNoChange,
    ChatNotFound,
}
