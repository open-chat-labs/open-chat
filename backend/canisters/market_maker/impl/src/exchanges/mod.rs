use async_trait::async_trait;
use ic_cdk::api::call::CallResult;
use types::{AggregatedOrders, CancelOrderRequest, CanisterId, MakeOrderRequest, MarketState, Order};

pub mod icdex;

#[async_trait]
pub trait Exchange: Send + Sync {
    async fn latest_price(&self) -> CallResult<u64>;
    async fn my_open_orders(&self) -> CallResult<Vec<Order>>;
    async fn orderbook(&self) -> CallResult<AggregatedOrders>;
    async fn make_orders(&self, orders: Vec<MakeOrderRequest>) -> CallResult<()>;
    async fn cancel_orders(&self, orders: Vec<CancelOrderRequest>) -> CallResult<()>;
    async fn account_balances(&self) -> CallResult<Vec<(CanisterId, u128)>>;
    async fn market_state(&self) -> CallResult<MarketState> {
        let (latest_price, my_open_orders, orderbook) =
            futures::future::try_join3(self.latest_price(), self.my_open_orders(), self.orderbook()).await?;

        Ok(MarketState {
            latest_price,
            my_open_orders,
            orderbook,
        })
    }
}
