use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::TimestampMillis;

#[ts_export(user, claim_daily_chit)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub utc_offset_mins: Option<i16>,
}

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
    pub utc_offset_updated: bool,
}
