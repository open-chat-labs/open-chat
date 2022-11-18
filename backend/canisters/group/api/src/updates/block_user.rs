use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotInGroup,
    CannotBlockSelf,
    CannotBlockUser,
    GroupNotPublic,
    InternalError(String),
    NotAuthorized,
    UserNotInGroup,
    UserSuspended,
    ChatFrozen,
}
