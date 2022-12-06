use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatFrozen, ChatId, EventWrapper, Milliseconds};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
    pub reason: Option<String>,
    pub suspend_members: Option<SuspendDuration>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuspendDuration {
    pub duration: Option<Milliseconds>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(EventWrapper<ChatFrozen>),
    ChatAlreadyFrozen,
    ChatNotFound,
    NotAuthorized,
    InternalError(String),
}
