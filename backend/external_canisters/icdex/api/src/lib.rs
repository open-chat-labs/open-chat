use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};
use types::OrderType;

mod queries;
mod updates;

pub use queries::*;
pub use updates::*;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum OrderQuantity {
    Buy(Nat, Nat),
    Sell(Nat),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct OrderPrice {
    pub price: Nat,
    pub quantity: OrderQuantity,
}

#[derive(CandidType, Deserialize)]
pub enum MakeOrderResponse {
    #[serde(rename = "ok")]
    Ok(MakeOrderSuccess),
    #[serde(rename = "err")]
    Err(MakeOrderError),
}

#[derive(CandidType, Deserialize)]
pub struct MakeOrderSuccess {
    pub status: OrderStatus,
    pub txid: Vec<u8>,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct MakeOrderError {
    pub code: MakeOrderErrorCode,
    pub message: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum MakeOrderErrorCode {
    NonceError,
    InvalidAmount,
    InsufficientBalance,
    TransferException,
    UnacceptableVolatility,
    TransactionBlocking,
    UndefinedError,
}

#[derive(CandidType, Serialize, Clone, Debug)]
pub enum ICDexOrderType {
    #[serde(rename = "LMT")]
    Limit,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct Orderbook {
    pub ask: Vec<PriceAndQuantity>,
    pub bid: Vec<PriceAndQuantity>,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct PriceAndQuantity {
    pub quantity: Nat,
    pub price: Nat,
}

#[derive(CandidType, Deserialize)]
pub struct TrieList {
    pub data: Vec<(Vec<u8>, TradingOrder)>,
    pub total: Nat,
    #[serde(rename = "totalPage")]
    pub total_page: Nat,
}

#[derive(CandidType, Deserialize)]
pub struct StatsResponse {
    pub price: f64,
}

#[derive(CandidType, Debug)]
pub enum Side {
    Buy,
    Sell,
}

impl From<OrderType> for Side {
    fn from(value: OrderType) -> Self {
        match value {
            OrderType::Bid => Side::Buy,
            OrderType::Ask => Side::Sell,
        }
    }
}

#[derive(CandidType, Deserialize)]
pub struct TradingOrder {
    pub remaining: OrderPrice,
    pub txid: Vec<u8>,
}

#[derive(CandidType, Deserialize)]
pub enum OrderStatus {
    Todo,
    Closed,
    Cancelled,
    Pending,
}
