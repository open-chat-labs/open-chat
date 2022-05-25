use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EventIndex, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_index: MessageIndex,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(EventIndex),
    NoChange,
    NotAuthorized,
    CallerNotInGroup,
}
