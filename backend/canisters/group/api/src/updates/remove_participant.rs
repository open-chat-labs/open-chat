use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UserId;

#[ts_export(group, remove_participant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub correlation_id: u64,
}

#[ts_export(group, remove_participant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotInGroup,
    CannotRemoveSelf,
    CannotRemoveUser,
    InternalError(String),
    NotAuthorized,
    UserNotInGroup,
    UserSuspended,
    UserLapsed,
    ChatFrozen,
    Error(OCError),
}
