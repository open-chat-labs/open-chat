use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};

mod lifecycle;
mod updates;

pub use lifecycle::*;
pub use updates::*;

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
pub enum ExchangeId {
    ICPSwap,
}

impl Display for ExchangeId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            ExchangeId::ICPSwap => f.write_str("ICPSwap"),
        }
    }
}
