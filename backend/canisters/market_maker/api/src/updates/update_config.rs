use crate::ExchangeId;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub exchange_id: ExchangeId,
    pub enabled: Option<bool>,
    pub price_increment: Option<u64>,
    pub order_size: Option<u64>,
    pub min_order_size: Option<u64>,
    pub max_buy_price: Option<u64>,
    pub min_sell_price: Option<u64>,
    pub spread: Option<u64>,
    pub min_orders_per_direction: Option<u32>,
    pub max_orders_per_direction: Option<u32>,
    pub max_orders_to_make_per_iteration: Option<u32>,
    pub max_orders_to_cancel_per_iteration: Option<u32>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ExchangeNotFound,
    NotAuthorized,
    InternalError(String),
}
