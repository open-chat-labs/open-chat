use crate::TimestampMillis;
use candid::CandidType;
use serde::{Deserialize, Serialize, Serializer};

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

pub struct CyclesHumanReadable(Cycles);

#[derive(Serialize)]
pub struct CyclesTopUpHumanReadable {
    date: TimestampMillis,
    amount: CyclesHumanReadable,
}

impl From<&CyclesTopUp> for CyclesTopUpHumanReadable {
    fn from(value: &CyclesTopUp) -> Self {
        CyclesTopUpHumanReadable {
            date: value.date,
            amount: value.amount.into(),
        }
    }
}

impl From<Cycles> for CyclesHumanReadable {
    fn from(value: Cycles) -> Self {
        CyclesHumanReadable(value)
    }
}

impl Serialize for CyclesHumanReadable {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&format!("{}T", self.0 as f64 / 1_000_000_000_000.0))
    }
}
