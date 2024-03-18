use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use types::Milliseconds;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub current: Option<Vec<u8>>,
    pub new: Option<Vec<u8>>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    PinRequired,
    PinIncorrect(Option<Milliseconds>),
    TooManyFailedPinAttempts(Milliseconds),
}
