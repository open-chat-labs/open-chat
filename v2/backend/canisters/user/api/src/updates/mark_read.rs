use candid::CandidType;
use serde::Deserialize;
use types::{MessageIndexRange, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_ranges: Vec<MessageIndexRange>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    SuccessNoChange,
    ChatNotFound,
}
