use candid::CandidType;
use serde::Deserialize;
use types::{MessageIndex, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_index: MessageIndex,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    PollNotFound,
    UnableToEndPoll,
    ChatNotFound,
}
