use candid::CandidType;
use serde::{Deserialize, Serialize};

mod lifecycle;
mod updates;

pub use lifecycle::*;
pub use updates::*;

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
pub enum ExchangeId {
    ICPSwap,
}
