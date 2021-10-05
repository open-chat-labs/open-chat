use candid::CandidType;
use serde::Deserialize;
use types::{MessageId, MessageIndexRange};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub message_index_ranges: Vec<MessageIndexRange>,
    pub message_ids: Vec<MessageId>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    SuccessNoChange,
    ChatNotFound,
}
