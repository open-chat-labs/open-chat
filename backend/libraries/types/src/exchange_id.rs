use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, Eq, PartialEq, TS)]
pub enum ExchangeId {
    ICPSwap,
    Sonic,
}

impl Display for ExchangeId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            ExchangeId::ICPSwap => f.write_str("ICPSwap"),
            ExchangeId::Sonic => f.write_str("Sonic"),
        }
    }
}
