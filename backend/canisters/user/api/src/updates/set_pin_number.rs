use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use ts_export::ts_export;
use types::{FieldTooLongResult, FieldTooShortResult, Milliseconds, SignedDelegation};

#[ts_export(user, set_pin_number)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub new: Option<String>,
    pub verification: PinNumberVerification,
}

#[ts_export(user, set_pin_number)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum PinNumberVerification {
    None,
    PIN(String),
    Delegation(SignedDelegation),
}

#[ts_export(user, set_pin_number)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    TooShort(FieldTooShortResult),
    TooLong(FieldTooLongResult),
    PinRequired,
    PinIncorrect(Milliseconds),
    TooManyFailedPinAttempts(Milliseconds),
    MalformedSignature(String),
    DelegationTooOld,
}
