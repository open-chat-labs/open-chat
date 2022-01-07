use candid::CandidType;
use serde::Deserialize;
use types::MessageIndex;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub message_index: Option<MessageIndex>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    NoChange,
    MessageIndexOutOfRange,
    NotAuthorized,
    CallerNotInGroup,
}
