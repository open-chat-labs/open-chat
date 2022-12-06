use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatFrozen, ChatId, EventWrapper, Milliseconds};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
    pub reason: Option<String>,
    pub suspend_members: Option<SuspensionDetails>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuspensionDetails {
    pub duration: Option<Milliseconds>,
    pub reason: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(EventWrapper<ChatFrozen>),
    ChatAlreadyFrozen,
    ChatNotFound,
    NotAuthorized,
    InternalError(String),
}
