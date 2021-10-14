use crate::TimestampMillis;
use candid::CandidType;
use serde::Deserialize;

pub type Cycles = u128;

#[derive(CandidType, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct CyclesTopUp {
    pub date: TimestampMillis,
    pub amount: Cycles,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct NotifyLowBalanceArgs {}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum NotifyLowBalanceResponse {
    Success(Cycles),
    NotEnoughCyclesRemaining,
    FailedToDepositCycles,
}
