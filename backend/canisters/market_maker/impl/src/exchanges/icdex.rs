use crate::exchanges::Exchange;
use async_trait::async_trait;
use ic_cdk::api::call::CallResult;
use icdex_client::ICDexClient;
use market_maker_canister::{ExchangeId, ICDEX_EXCHANGE_ID};
use types::{CancelOrderRequest, MakeOrderRequest, MarketState};

#[async_trait]
impl<M: Fn(MakeOrderRequest) + Send + Sync, C: Fn(CancelOrderRequest) + Send + Sync> Exchange for ICDexClient<M, C> {
    fn exchange_id(&self) -> ExchangeId {
        ICDEX_EXCHANGE_ID
    }

    async fn market_state(&self) -> CallResult<MarketState> {
        let (latest_price, my_open_orders, orderbook) =
            futures::future::try_join3(self.latest_price(), self.my_open_orders(), self.orderbook()).await?;

        Ok(MarketState {
            latest_price,
            my_open_orders,
            orderbook,
        })
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
