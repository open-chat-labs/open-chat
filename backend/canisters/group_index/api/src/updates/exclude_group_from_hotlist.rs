use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::ChatId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
    pub reason: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ChatAlreadyExcluded,
    ChatNotFound,
    NotAuthorized,
    InternalError(String),
}
