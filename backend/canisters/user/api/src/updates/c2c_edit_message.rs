use candid::CandidType;
use serde::Deserialize;
use types::{MessageContent, MessageId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub content: MessageContent,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    ChatNotFound,
    UserBlocked,
}
