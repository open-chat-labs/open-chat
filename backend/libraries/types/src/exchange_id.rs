use candid::CandidType;
use std::fmt::{Display, Formatter};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Clone, Copy, Debug, Eq, PartialEq)]
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
