use crate::TimestampMillis;
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct CyclesTopUp {
    pub date: TimestampMillis,
    pub amount: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct NotifyLowBalanceArgs {}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum NotifyLowBalanceResponse {
    Success(u64),
    NotEnoughCyclesRemaining,
    FailedToDepositCycles,
}
