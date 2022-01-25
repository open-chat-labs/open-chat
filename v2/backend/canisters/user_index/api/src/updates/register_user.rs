use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub username: String,
    pub bio: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyRegistered,
    UserLimitReached,
    UsernameTaken,
    UsernameInvalid,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
    BioTooLong(u16),
    NotSupported,
}
