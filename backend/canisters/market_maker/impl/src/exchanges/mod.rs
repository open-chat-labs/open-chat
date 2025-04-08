use async_trait::async_trait;
use types::{AggregatedOrders, C2CError, CancelOrderRequest, CanisterId, MakeOrderRequest, MarketState, Order};

pub mod icdex;

#[async_trait]
pub trait Exchange: Send + Sync {
    async fn latest_price(&self) -> Result<u64, C2CError>;
    async fn my_open_orders(&self) -> Result<Vec<Order>, C2CError>;
    async fn orderbook(&self) -> Result<AggregatedOrders, C2CError>;
    async fn make_orders(&self, orders: Vec<MakeOrderRequest>) -> Result<(), C2CError>;
    async fn cancel_orders(&self, orders: Vec<CancelOrderRequest>) -> Result<(), C2CError>;
    async fn account_balances(&self) -> Result<Vec<(CanisterId, u128)>, C2CError>;
    async fn market_state(&self) -> Result<MarketState, C2CError> {
        let (latest_price, my_open_orders, orderbook) =
            futures::future::try_join3(self.latest_price(), self.my_open_orders(), self.orderbook()).await?;

        Ok(MarketState {
            latest_price,
            my_open_orders,
            orderbook,
        })
    }
}
