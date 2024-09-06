use crate::{Achievement, ReferralStatus, TimestampMillis};
use candid::CandidType;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Clone, Debug)]
pub struct ChitEarned {
    pub amount: i32,
    pub timestamp: TimestampMillis,
    pub reason: ChitEarnedReason,
}

#[ts_export]
#[derive(CandidType, Clone, Debug)]
pub enum ChitEarnedReason {
    DailyClaim,
    Achievement(Achievement),
    Referral(ReferralStatus),
    MemeContestWinner,
}

#[ts_export]
#[derive(CandidType, Clone, Debug, Default)]
pub struct Chit {
    pub balance: i32,
    pub streak: u16,
}
