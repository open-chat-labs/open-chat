use async_trait::async_trait;
use ic_cdk::call::RejectCode;
use types::{AggregatedOrders, CancelOrderRequest, CanisterId, MakeOrderRequest, MarketState, Order};

pub mod icdex;

#[async_trait]
pub trait Exchange: Send + Sync {
    async fn latest_price(&self) -> Result<u64, (RejectCode, String)>;
    async fn my_open_orders(&self) -> Result<Vec<Order>, (RejectCode, String)>;
    async fn orderbook(&self) -> Result<AggregatedOrders, (RejectCode, String)>;
    async fn make_orders(&self, orders: Vec<MakeOrderRequest>) -> Result<(), (RejectCode, String)>;
    async fn cancel_orders(&self, orders: Vec<CancelOrderRequest>) -> Result<(), (RejectCode, String)>;
    async fn account_balances(&self) -> Result<Vec<(CanisterId, u128)>, (RejectCode, String)>;
    async fn market_state(&self) -> Result<MarketState, (RejectCode, String)> {
        let (latest_price, my_open_orders, orderbook) =
            futures::future::try_join3(self.latest_price(), self.my_open_orders(), self.orderbook()).await?;

        Ok(MarketState {
            latest_price,
            my_open_orders,
            orderbook,
        })
    }
}
