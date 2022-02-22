use candid::CandidType;
use serde::Deserialize;
use types::{EventIndex, MessageIndex};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub message_index: MessageIndex,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(EventIndex),
    NoChange,
    MessageIndexOutOfRange,
    NotAuthorized,
    CallerNotInGroup,
}
