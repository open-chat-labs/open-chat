use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use ts_export::ts_export;
use types::{EmptySuccessOrError, PinNumberWrapper, SignedDelegation};

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

pub type Response = EmptySuccessOrError;
