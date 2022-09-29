use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::ChatId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    GroupNotFound,
    GroupNotPublic,
    InternalError(String),
    CallerNotInGroup,
    OwnerCannotLeave,
}
