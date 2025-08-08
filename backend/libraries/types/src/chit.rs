use crate::{Achievement, ReferralStatus, TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChitEvent {
    pub amount: i32,
    pub timestamp: TimestampMillis,
    pub reason: ChitEventType,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NotifyChit {
    pub timestamp: TimestampMillis,
    #[serde(default)]
    pub total_chit_earned: i32,
    pub chit_balance: i32,
    pub streak: u16,
    pub streak_ends: TimestampMillis,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ChitEventType {
    DailyClaim,
    Achievement(Achievement),
    ExternalAchievement(String),
    Referral(ReferralStatus),
    MemeContestWinner,
    DailyClaimReinstated,
    StreakInsuranceClaim,
    PurchasedPremiumItem(u32),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct Chit {
    pub balance: i32,
    pub streak: u16,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct StreakInsurance {
    pub days_insured: u8,
    pub days_missed: u8,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserCanisterStreakInsurancePayment {
    pub timestamp: TimestampMillis,
    pub chat_amount: u128,
    pub additional_days: u8,
    pub new_days_insured: u8,
    pub transaction_index: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserCanisterStreakInsuranceClaim {
    pub timestamp: TimestampMillis,
    pub streak_length: u16,
    pub new_days_claimed: u8,
    #[serde(default)]
    pub insured_days_remaining: u8,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StreakInsurancePayment {
    pub user_id: UserId,
    pub timestamp: TimestampMillis,
    pub chat_amount: u128,
    pub additional_days: u8,
    pub new_days_insured: u8,
    pub transaction_index: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StreakInsuranceClaim {
    pub user_id: UserId,
    pub timestamp: TimestampMillis,
    pub streak_length: u16,
    pub new_days_claimed: u8,
}
