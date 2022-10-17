use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageIndex, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_index: MessageIndex,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    PollNotFound,
    UnableToEndPoll,
    ChatNotFound,
}
