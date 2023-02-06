use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(CandidType, Deserialize, Serialize, Debug)]
pub struct Args {
    pub group: CanisterId,
}

#[derive(CandidType, Deserialize, Serialize, Debug)]
pub enum Response {
    Success,
    AlreadyInGroup,
    GroupNotFound,
    GroupNotPublic,
    ParticipantLimitReached,
    Blocked,
    UserSuspended,
    ChatFrozen,
    InternalError(String),
}
