use crate::{Achievement, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub struct ChitEarned {
    pub amount: i32,
    pub timestamp: TimestampMillis,
    pub reason: ChitEarnedReason,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub enum ChitEarnedReason {
    DailyClaim,
    Achievement(Achievement),
    MemeContestWinner,
}
