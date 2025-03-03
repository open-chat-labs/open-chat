#![allow(deprecated)]
use crate::CanisterId;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fmt::{Display, Formatter};
use ts_export::ts_export;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct MakeOrderRequest {
    pub order_type: OrderType,
    pub price: u64,
    pub amount: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CancelOrderRequest {
    pub id: String,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
#[serde(from = "TokenInfoCombined")]
pub struct TokenInfo {
    pub symbol: String,
    pub token: crate::Cryptocurrency,
    pub ledger: CanisterId,
    pub decimals: u8,
    pub fee: u128,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TokenInfoCombined {
    pub symbol: Option<String>,
    pub token: Option<crate::Cryptocurrency>,
    pub ledger: CanisterId,
    pub decimals: u8,
    pub fee: u128,
}

impl From<TokenInfoCombined> for TokenInfo {
    fn from(value: TokenInfoCombined) -> Self {
        let symbol = value
            .symbol
            .unwrap_or_else(|| value.token.unwrap().token_symbol().to_string());

        TokenInfo {
            token: symbol.clone().into(),
            symbol,
            ledger: value.ledger,
            decimals: value.decimals,
            fee: value.fee,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, Eq, PartialEq)]
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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Order {
    pub order_type: OrderType,
    pub id: String,
    pub price: u64,
    pub amount: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MarketState {
    pub latest_price: u64,
    pub my_open_orders: Vec<Order>,
    pub orderbook: AggregatedOrders,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct AggregatedOrders {
    pub bids: BTreeMap<u64, u64>,
    pub asks: BTreeMap<u64, u64>,
}

impl From<&[Order]> for AggregatedOrders {
    fn from(orders: &[Order]) -> Self {
        let mut aggregated_orders = AggregatedOrders::default();
        for order in orders {
            aggregated_orders.add(order.order_type, order.price, order.amount);
        }
        aggregated_orders
    }
}

impl AggregatedOrders {
    pub fn add(&mut self, order_type: OrderType, price: u64, amount: u64) {
        match order_type {
            OrderType::Bid => *self.bids.entry(price).or_default() += amount,
            OrderType::Ask => *self.asks.entry(price).or_default() += amount,
        }
    }
}
