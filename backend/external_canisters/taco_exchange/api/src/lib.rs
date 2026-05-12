use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

mod queries;
mod updates;

pub use queries::*;
pub use updates::*;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SwapHop {
    #[serde(rename = "tokenIn")]
    pub token_in: String,
    #[serde(rename = "tokenOut")]
    pub token_out: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SwapOk {
    #[serde(rename = "amountIn")]
    pub amount_in: Nat,
    #[serde(rename = "amountOut")]
    pub amount_out: Nat,
    pub fee: Nat,
    #[serde(rename = "firstHopOrderbookMatch")]
    pub first_hop_orderbook_match: bool,
    pub hops: Nat,
    #[serde(rename = "lastHopAMMOnly")]
    pub last_hop_amm_only: bool,
    pub route: Vec<String>,
    #[serde(rename = "swapId")]
    pub swap_id: Nat,
    #[serde(rename = "tokenIn")]
    pub token_in: String,
    #[serde(rename = "tokenOut")]
    pub token_out: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SlippageExceededDetail {
    pub expected: Nat,
    pub got: Nat,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct RouteFailedDetail {
    pub hop: Nat,
    pub reason: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ExchangeError {
    Banned,
    ExchangeFrozen,
    InsufficientFunds(String),
    InvalidInput(String),
    NotAuthorized,
    OrderNotFound(String),
    PoolNotFound(String),
    RouteFailed(RouteFailedDetail),
    SlippageExceeded(SlippageExceededDetail),
    SystemError(String),
    TokenNotAccepted(String),
    TokenPaused(String),
    TransferFailed(String),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum SwapResult {
    Ok(SwapOk),
    Err(ExchangeError),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct HopDetail {
    #[serde(rename = "amountIn")]
    pub amount_in: Nat,
    #[serde(rename = "amountOut")]
    pub amount_out: Nat,
    pub fee: Nat,
    #[serde(rename = "priceImpact")]
    pub price_impact: f64,
    #[serde(rename = "tokenIn")]
    pub token_in: String,
    #[serde(rename = "tokenOut")]
    pub token_out: String,
}
