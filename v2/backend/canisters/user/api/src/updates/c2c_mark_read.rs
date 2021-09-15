use candid::CandidType;
use serde::Deserialize;
use types::MessageIndex;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub messages: Vec<MessageIndex>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    SuccessNoChange,
    ChatNotFound,
}
