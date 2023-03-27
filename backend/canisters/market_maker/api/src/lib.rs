use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

pub const ICDEX_EXCHANGE_ID: ExchangeId = ExchangeId::new(1);

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ExchangeInfo {
    pub id: ExchangeId,
    pub name: String,
}

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, Ord, PartialOrd, Eq, PartialEq, Hash)]
pub struct ExchangeId(u32);

impl ExchangeId {
    pub const fn new(id: u32) -> ExchangeId {
        ExchangeId(id)
    }
}

impl From<u32> for ExchangeId {
    fn from(value: u32) -> ExchangeId {
        ExchangeId::new(value)
    }
}

impl Display for ExchangeId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MakeOrderRequest {
    pub order_type: OrderType,
    pub price: u64,
    pub amount: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CancelOrderRequest {
    pub id: String,
}

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug)]
pub enum OrderType {
    Bid,
    Ask,
}

impl Display for OrderType {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            OrderType::Bid => f.write_str("Bid"),
            OrderType::Ask => f.write_str("Ask"),
        }
    }
}
