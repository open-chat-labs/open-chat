use crate::TimestampMillis;
use candid::CandidType;
use serde::{Deserialize, Serialize};

pub type Cycles = u128;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct CyclesTopUp {
    pub date: TimestampMillis,
    pub amount: Cycles,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct NotifyLowBalanceArgs {}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum NotifyLowBalanceResponse {
    Success(Cycles),
    NotEnoughCyclesRemaining,
    FailedToDepositCycles,
}
