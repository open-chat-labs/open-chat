use crate::exchanges::Exchange;
use async_trait::async_trait;
use icdex_client::ICDexClient;
use types::{AggregatedOrders, C2CError, CancelOrderRequest, CanisterId, MakeOrderRequest, Order};

#[async_trait]
impl<M: Fn(MakeOrderRequest) + Send + Sync, C: Fn(CancelOrderRequest) + Send + Sync> Exchange for ICDexClient<M, C> {
    async fn latest_price(&self) -> Result<u64, C2CError> {
        self.latest_price().await
    }

    async fn my_open_orders(&self) -> Result<Vec<Order>, C2CError> {
        self.my_open_orders().await
    }

    async fn orderbook(&self) -> Result<AggregatedOrders, C2CError> {
        self.orderbook().await
    }

    async fn make_orders(&self, orders: Vec<MakeOrderRequest>) -> Result<(), C2CError> {
        for order in orders {
            self.make_order(order).await?;
        }
        Ok(())
    }

    async fn cancel_orders(&self, orders: Vec<CancelOrderRequest>) -> Result<(), C2CError> {
        for order in orders {
            self.cancel_order(order).await?;
        }
        Ok(())
    }

    async fn account_balances(&self) -> Result<Vec<(CanisterId, u128)>, C2CError> {
        self.account_balances().await
    }
}
