use crate::{Achievement, ReferralStatus, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChitEarned {
    pub amount: i32,
    pub timestamp: TimestampMillis,
    pub reason: ChitEarnedReason,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NotifyChit {
    pub timestamp: TimestampMillis,
    pub chit_balance: i32,
    pub streak: u16,
    pub streak_ends: TimestampMillis,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ChitEarnedReason {
    DailyClaim,
    Achievement(Achievement),
    ExternalAchievement(String),
    Referral(ReferralStatus),
    MemeContestWinner,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct Chit {
    pub balance: i32,
    pub streak: u16,
}
