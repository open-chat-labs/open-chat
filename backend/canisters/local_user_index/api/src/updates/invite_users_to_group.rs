use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_id: ChatId,
    pub user_ids: Vec<UserId>,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    GroupNotFound,
    CallerNotInGroup,
    NotAuthorized,
    ChatFrozen,
    TooManyInvites(u32),
    InternalError(String),
}
