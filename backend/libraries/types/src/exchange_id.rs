use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, Eq, PartialEq)]
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
