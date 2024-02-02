use crate::exchanges::Exchange;
use async_trait::async_trait;
use ic_cdk::api::call::CallResult;
use icdex_client::ICDexClient;
use types::{AggregatedOrders, CancelOrderRequest, MakeOrderRequest, Order, TokenInfo};

#[async_trait]
impl<M: Fn(MakeOrderRequest) + Send + Sync, C: Fn(CancelOrderRequest) + Send + Sync> Exchange for ICDexClient<M, C> {
    fn quote_token(&self) -> &TokenInfo {
        self.quote_token()
    }

    fn base_token(&self) -> &TokenInfo {
        self.base_token()
    }

    async fn latest_price(&self) -> CallResult<u64> {
        self.latest_price().await
    }

    async fn my_open_orders(&self) -> CallResult<Vec<Order>> {
        self.my_open_orders().await
    }

    async fn orderbook(&self) -> CallResult<AggregatedOrders> {
        self.orderbook().await
    }

    async fn make_orders(&self, orders: Vec<MakeOrderRequest>) -> CallResult<()> {
        for order in orders {
            self.make_order(order).await?;
        }
        Ok(())
    }

    async fn cancel_orders(&self, orders: Vec<CancelOrderRequest>) -> CallResult<()> {
        for order in orders {
            self.cancel_order(order).await?;
        }
        Ok(())
    }
}
