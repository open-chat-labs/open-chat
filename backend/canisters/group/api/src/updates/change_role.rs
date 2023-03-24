use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Role, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub new_role: Role,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotInGroup,
    NotAuthorized,
    UserNotInGroup,
    UserSuspended,
    Invalid,
    ChatFrozen,
    InternalError(String),
}
