use candid::CandidType;
use serde::Deserialize;
use shared::types::group_message::Message;
use shared::types::MessageIndex;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub messages: Vec<MessageIndex>,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorised,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    pub messages: Vec<Message>,
}
