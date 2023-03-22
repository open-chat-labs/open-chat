use crate::MarketState;
use async_trait::async_trait;
use ic_cdk::api::call::CallResult;
use market_maker_canister::{CancelOrderRequest, MakeOrderRequest};

pub mod icdex;

#[async_trait]
pub trait Exchange {
    async fn market_state(&self) -> CallResult<MarketState>;
    async fn make_orders(&self, orders: Vec<MakeOrderRequest>) -> CallResult<()>;
    async fn cancel_orders(&self, orders: Vec<CancelOrderRequest>) -> CallResult<()>;
}
