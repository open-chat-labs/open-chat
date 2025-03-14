use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub principal: Principal,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
    OwnerCannotLeave,
    UserSuspended,
    ChatFrozen,
    Error(u16, Option<String>),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {}
