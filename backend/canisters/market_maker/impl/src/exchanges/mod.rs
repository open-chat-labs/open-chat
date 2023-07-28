use crate::MarketSnapshot;
use async_trait::async_trait;
use ic_cdk::api::call::CallResult;
use market_maker_canister::{CancelOrderRequest, ExchangeId, MakeOrderRequest};

pub mod icdex;

#[async_trait]
pub trait Exchange {
    fn exchange_id(&self) -> ExchangeId;
    async fn market_state(&self) -> CallResult<MarketSnapshot>;
    async fn make_orders(&self, orders: Vec<MakeOrderRequest>) -> CallResult<()>;
    async fn cancel_orders(&self, orders: Vec<CancelOrderRequest>) -> CallResult<()>;
}
