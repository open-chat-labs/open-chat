use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use types::{FieldTooLongResult, FieldTooShortResult, Milliseconds};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub current: Option<String>,
    pub new: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    TooShort(FieldTooShortResult),
    TooLong(FieldTooLongResult),
    PinRequired,
    PinIncorrect(Milliseconds),
    TooManyFailedPinAttempts(Milliseconds),
}
