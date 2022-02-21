use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub username: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    UsernameTaken,
    UserNotFound,
    UsernameInvalid,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
}
