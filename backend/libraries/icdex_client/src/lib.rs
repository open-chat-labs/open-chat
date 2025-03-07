use candid::Nat;
use ic_cdk::call::RejectCode;
use icdex_canister::{ICDexOrderType, MakeOrderResponse, OrderPrice, OrderQuantity, TradingOrder};
use types::{AggregatedOrders, CancelOrderRequest, CanisterId, MakeOrderRequest, Order, OrderType, TokenInfo};

pub struct ICDexClient<M: Fn(MakeOrderRequest), C: Fn(CancelOrderRequest)> {
    this_canister_id: CanisterId,
    dex_canister_id: CanisterId,
    quote_token: TokenInfo,
    base_token: TokenInfo,
    smallest_order_size: u64, // In base token units, all orders are multiples of this size
    on_order_made: M,
    on_order_cancelled: C,
}

impl<M: Fn(MakeOrderRequest), C: Fn(CancelOrderRequest)> ICDexClient<M, C> {
    pub fn new(
        this_canister_id: CanisterId,
        dex_canister_id: CanisterId,
        quote_token: TokenInfo,
        base_token: TokenInfo,
        smallest_order_size: u64,
        on_order_made: M,
        on_order_cancelled: C,
    ) -> Self {
        ICDexClient {
            this_canister_id,
            dex_canister_id,
            quote_token,
            base_token,
            smallest_order_size,
            on_order_made,
            on_order_cancelled,
        }
    }

    pub async fn latest_price(&self) -> Result<u64, (RejectCode, String)> {
        let response = icdex_canister_c2c_client::stats(self.dex_canister_id, ()).await?.0;

        Ok((response.price * self.quote_token_units_per_whole() as f64) as u64)
    }

    pub async fn my_open_orders(&self) -> Result<Vec<Order>, (RejectCode, String)> {
        let args = (self.this_canister_id.to_string(), None, Some(Nat::from(250u32)));

        let orders = icdex_canister_c2c_client::pending(self.dex_canister_id, args).await?.0;

        Ok(orders
            .data
            .into_iter()
            .map(|(_, o)| self.convert_order(o))
            .filter(|o| o.amount > 0)
            .collect())
    }

    pub async fn orderbook(&self) -> Result<AggregatedOrders, (RejectCode, String)> {
        let (_, orderbook) = icdex_canister_c2c_client::level10(self.dex_canister_id, ()).await?;

        Ok(AggregatedOrders {
            bids: orderbook
                .bid
                .into_iter()
                .map(|p| {
                    (
                        u64::try_from(p.price.0).unwrap() * self.base_token_units_per_whole() / self.smallest_order_size,
                        u64::try_from(p.quantity.0).unwrap(),
                    )
                })
                .collect(),
            asks: orderbook
                .ask
                .into_iter()
                .map(|p| {
                    (
                        u64::try_from(p.price.0).unwrap() * self.base_token_units_per_whole() / self.smallest_order_size,
                        u64::try_from(p.quantity.0).unwrap(),
                    )
                })
                .collect(),
        })
    }

    pub async fn make_order(&self, order: MakeOrderRequest) -> Result<(), (RejectCode, String)> {
        let quantity = match order.order_type {
            OrderType::Bid => OrderQuantity::Buy(order.amount.into(), 0u32.into()),
            OrderType::Ask => OrderQuantity::Sell(order.amount.into()),
        };
        // Convert the price per whole into the price per `smallest_order_size`
        let price = (order.price * self.smallest_order_size / self.base_token_units_per_whole()).into();

        let args = (OrderPrice { price, quantity }, ICDexOrderType::Limit, None, None, None, None);

        match icdex_canister_c2c_client::trade(self.dex_canister_id, args.clone()).await?.0 {
            MakeOrderResponse::Ok(_) => {
                (self.on_order_made)(order);
                Ok(())
            }
            MakeOrderResponse::Err(e) => Err((RejectCode::CanisterError, format!("Args: {args:?}. Error: {e:?}"))),
        }
    }

    pub async fn cancel_order(&self, order: CancelOrderRequest) -> Result<(), (RejectCode, String)> {
        let id = hex::decode(&order.id).unwrap();

        icdex_canister_c2c_client::cancelByTxid(self.dex_canister_id, (id, None)).await?;

        (self.on_order_cancelled)(order);
        Ok(())
    }

    pub async fn account_balances(&self) -> Result<Vec<(CanisterId, u128)>, (RejectCode, String)> {
        let response =
            icdex_canister_c2c_client::accountBalance(self.dex_canister_id, &self.this_canister_id.to_string()).await?;

        Ok(vec![
            (
                self.base_token.ledger,
                u128::try_from((response.token0.available + response.token0.locked).0).unwrap(),
            ),
            (
                self.quote_token.ledger,
                u128::try_from((response.token1.available + response.token1.locked).0).unwrap(),
            ),
        ])
    }

    fn convert_order(&self, order: TradingOrder) -> Order {
        let (order_type, amount) = match order.remaining.quantity {
            OrderQuantity::Buy(n, _) => (OrderType::Bid, n),
            OrderQuantity::Sell(n) => (OrderType::Ask, n),
        };
        let price: u64 = order.remaining.price.0.try_into().unwrap();
        Order {
            order_type,
            id: hex::encode(order.txid),
            price: price * self.base_token_units_per_whole() / self.smallest_order_size,
            amount: amount.0.try_into().unwrap(),
        }
    }

    fn quote_token_units_per_whole(&self) -> u64 {
        Self::units_per_whole(self.quote_token.decimals)
    }

    fn base_token_units_per_whole(&self) -> u64 {
        Self::units_per_whole(self.base_token.decimals)
    }

    fn units_per_whole(decimals: u8) -> u64 {
        10u64.pow(decimals as u32)
    }
}
