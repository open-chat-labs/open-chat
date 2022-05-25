use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub username: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UsernameTaken,
    UsernameInvalid,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
}
