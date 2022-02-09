use candid::CandidType;
use serde::Deserialize;
use types::UserId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub username: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(UserId),
    AlreadyRegistered,
    UserLimitReached,
    UsernameTaken,
    UsernameInvalid,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
    CyclesBalanceTooLow,
    InternalError(String),
}
