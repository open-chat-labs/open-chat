use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(CandidType, Deserialize, Serialize, Debug)]
pub struct Args {
    pub group: CanisterId,
    pub remove_only: bool,
}

#[derive(CandidType, Deserialize, Serialize, Debug)]
pub enum Response {
    Success,
    CallerNotInGroup,
    OwnerCannotLeave,
    UserSuspended,
    ChatFrozen,
    InternalError(String),
}
