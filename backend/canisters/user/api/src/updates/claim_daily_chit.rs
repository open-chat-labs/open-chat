use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{Empty, TimestampMillis};

pub type Args = Empty;

#[ts_export(user, claim_daily_chit)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    AlreadyClaimed(TimestampMillis),
}

#[ts_export(user, claim_daily_chit)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub chit_earned: u32,
    pub chit_balance: i32,
    pub streak: u16,
    pub max_streak: u16,
    pub next_claim: TimestampMillis,
}
