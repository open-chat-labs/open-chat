use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use ts_export::ts_export;
use types::{PinNumberWrapper, SignedDelegation, UnitResult};

#[ts_export(user, set_pin_number)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub new: Option<PinNumberWrapper>,
    pub verification: PinNumberVerification,
}

#[ts_export(user, set_pin_number)]
#[derive(Serialize, Deserialize, Debug)]
pub enum PinNumberVerification {
    None,
    PIN(PinNumberWrapper),
    Delegation(SignedDelegation),
}

pub type Response = UnitResult;
