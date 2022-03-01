use candid::CandidType;
use serde::Deserialize;
use types::MessageIndex;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub message_index: MessageIndex,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    PollNotFound,
    UnableToEndPoll,
}
