use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use ts_export::ts_export;
use types::{FieldTooLongResult, FieldTooShortResult, Milliseconds, PinNumberWrapper, SignedDelegation};

#[ts_export(user, set_pin_number)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub new: Option<PinNumberWrapper>,
    pub verification: PinNumberVerification,
}

#[ts_export(user, set_pin_number)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum PinNumberVerification {
    None,
    PIN(PinNumberWrapper),
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
    Error(OCError),
}
