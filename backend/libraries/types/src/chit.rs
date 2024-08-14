use crate::{Achievement, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChitEarned {
    pub amount: i32,
    pub timestamp: TimestampMillis,
    pub reason: ChitEarnedReason,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ChitEarnedReason {
    DailyClaim,
    Achievement(Achievement),
    MemeContestWinner,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct Chit {
    pub balance: i32,
    pub streak: u16,
}
