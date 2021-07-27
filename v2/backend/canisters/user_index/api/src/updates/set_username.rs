use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub username: String,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
    UsernameTaken,
    UserUnconfirmed,
    UserNotFound,
    UsernameInvalid,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
}
