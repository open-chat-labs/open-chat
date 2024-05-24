use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::TimestampMillis;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChitEarned {
    pub amount: i32,
    pub timestamp: TimestampMillis,
    pub reason: ChitEarnedReason,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ChitEarnedReason {
    DailyClaim,
    Achievement(String),
    MemeContestWinner,
}
