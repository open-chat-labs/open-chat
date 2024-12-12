use crate::TimestampMillis;
use candid::CandidType;
use serde::{Deserialize, Serialize};

pub type Cycles = u128;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct CyclesTopUp {
    pub date: TimestampMillis,
    pub amount: Cycles,
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct CyclesTopUpInternal {
    #[serde(rename = "d")]
    pub date: TimestampMillis,
    #[serde(rename = "a")]
    pub amount: Cycles,
}

impl From<CyclesTopUp> for CyclesTopUpInternal {
    fn from(value: CyclesTopUp) -> Self {
        CyclesTopUpInternal {
            date: value.date,
            amount: value.amount,
        }
    }
}

impl From<&CyclesTopUpInternal> for CyclesTopUp {
    fn from(value: &CyclesTopUpInternal) -> Self {
        CyclesTopUp {
            date: value.date,
            amount: value.amount,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct NotifyLowBalanceArgs {}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum NotifyLowBalanceResponse {
    Success(Cycles),
    NotEnoughCyclesRemaining,
    FailedToDepositCycles,
}

#[derive(Serialize)]
pub struct CyclesTopUpHumanReadable {
    date: TimestampMillis,
    amount: f64,
}

impl From<&CyclesTopUp> for CyclesTopUpHumanReadable {
    fn from(value: &CyclesTopUp) -> Self {
        CyclesTopUpHumanReadable {
            date: value.date,
            amount: value.amount as f64 / 1_000_000_000_000f64,
        }
    }
}
