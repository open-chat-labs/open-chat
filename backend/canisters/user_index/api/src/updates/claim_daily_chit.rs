use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Empty, TimestampMillis};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    AlreadyClaimed(TimestampMillis),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub chit_earned: u32,
    pub chit_balance: i32,
    pub streak: u16,
    pub next_claim: TimestampMillis,
}
