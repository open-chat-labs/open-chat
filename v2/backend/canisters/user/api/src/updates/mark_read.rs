use candid::CandidType;
use serde::Deserialize;
use types::{MessageId, MessageIndexRange, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_index_ranges: Vec<MessageIndexRange>,
    pub message_ids: Vec<MessageId>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoChange(SuccessResult),
    ChatNotFound,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub unrecognised_message_ids: Vec<MessageId>,
}
