use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
    OwnerCannotLeave,
    UserSuspended,
    ChatFrozen,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {}
