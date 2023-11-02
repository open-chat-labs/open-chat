use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Chat, Message, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub reporter: UserId,
    pub chat_id: Chat,
    pub message: Message,
    pub reason_code: u32,
    pub notes: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    InternalError(String),
}
