use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub username: Option<String>,
    pub bio: Option<String>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    UsernameTaken,
    UserNotCreated,
    UsernameInvalid,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
    BioTooLong(u16),
}
