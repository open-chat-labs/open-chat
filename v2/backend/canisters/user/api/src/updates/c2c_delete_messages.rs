use candid::CandidType;
use serde::Deserialize;
use types::MessageId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub message_ids: Vec<MessageId>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    ChatNotFound,
}
