use candid::CandidType;
use std::fmt::Debug;
use ts_export::ts_export;
use types::{FieldTooLongResult, FieldTooShortResult, Milliseconds};

#[ts_export(user, set_pin_number)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub current: Option<String>,
    pub new: Option<String>,
}

#[ts_export(user, set_pin_number)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    TooShort(FieldTooShortResult),
    TooLong(FieldTooLongResult),
    PinRequired,
    PinIncorrect(Milliseconds),
    TooManyFailedPinAttempts(Milliseconds),
}
