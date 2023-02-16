use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ChatNotFrozen,
    ChatNotFrozenLongEnough(TimestampMillis),
    ChatNotFound,
    NotAuthorized,
    InternalError(String),
}
