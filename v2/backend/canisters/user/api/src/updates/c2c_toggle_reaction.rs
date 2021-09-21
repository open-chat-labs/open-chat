use candid::CandidType;
use serde::Deserialize;
use types::MessageId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub reaction: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Added,
    Removed,
    MessageNotFound,
    ChatNotFound,
}
