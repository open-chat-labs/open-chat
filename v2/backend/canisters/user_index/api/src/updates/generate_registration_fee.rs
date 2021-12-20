use candid::CandidType;
use serde::Deserialize;
use types::{Cycles, TimestampMillis};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    AlreadyRegistered,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub amount: Cycles,
    pub valid_until: TimestampMillis,
}
