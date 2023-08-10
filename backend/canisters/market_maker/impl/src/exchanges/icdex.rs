use crate::exchanges::Exchange;
use crate::{AggregatedOrders, MarketState, Order};
use async_trait::async_trait;
use candid::{CandidType, Nat};
use canister_client::make_c2c_call;
use ic_cdk::api::call::{CallResult, RejectionCode};
use market_maker_canister::{CancelOrderRequest, ExchangeId, MakeOrderRequest, OrderType, ICDEX_EXCHANGE_ID};
use serde::{Deserialize, Serialize};
use types::icrc1::{Account, TransferArg};
use types::CanisterId;

pub struct ICDexClient {
    this_canister_id: CanisterId,
    dex_canister_id: CanisterId,
    icp_ledger_canister_id: CanisterId,
    chat_ledger_canister_id: CanisterId,
    unit_size: u64,
    on_order_made: fn(ExchangeId, MakeOrderRequest) -> (),
    on_order_cancelled: fn(ExchangeId, CancelOrderRequest) -> (),
}

impl ICDexClient {
    pub fn new(
        this_canister_id: CanisterId,
        dex_canister_id: CanisterId,
        icp_ledger_canister_id: CanisterId,
        chat_ledger_canister_id: CanisterId,
        unit_size: u64,
        on_order_made: fn(ExchangeId, MakeOrderRequest) -> (),
        on_order_cancelled: fn(ExchangeId, CancelOrderRequest) -> (),
    ) -> ICDexClient {
        ICDexClient {
            this_canister_id,
            dex_canister_id,
            icp_ledger_canister_id,
            chat_ledger_canister_id,
            unit_size,
            on_order_made,
            on_order_cancelled,
        }
    }

    async fn latest_price(&self) -> CallResult<u64> {
        let response: StatsResponse = make_c2c_call(self.dex_canister_id, "stats", (), candid::encode_args, |r| {
            candid::decode_one(r)
        })
        .await?;

        Ok((response.price * 100_000_000f64) as u64)
    }

    async fn my_open_orders(&self) -> CallResult<Vec<Order>> {
        type OpenOrdersArgs = (String, Option<Nat>, Option<Nat>);

        let args: OpenOrdersArgs = (self.this_canister_id.to_string(), None, None);

        let orders: TrieList = make_c2c_call(self.dex_canister_id, "pending", args, candid::encode_args, |r| {
            candid::decode_one(r)
        })
        .await?;

        Ok(orders.data.into_iter().map(|(_, o)| o.into()).collect())
    }

    async fn orderbook(&self) -> CallResult<AggregatedOrders> {
        let (_, orderbook): (Nat, Orderbook) = make_c2c_call(self.dex_canister_id, "level10", (), candid::encode_args, |r| {
            candid::decode_args(r)
        })
        .await?;

        Ok(AggregatedOrders {
            bids: orderbook
                .bid
                .into_iter()
                .map(|p| {
                    (
                        u64::try_from(p.price.0).unwrap() * 10,
                        u64::try_from(p.quantity.0).unwrap() * 10,
                    )
                })
                .collect(),
            asks: orderbook
                .ask
                .into_iter()
                .map(|p| {
                    (
                        u64::try_from(p.price.0).unwrap() * 10,
                        u64::try_from(p.quantity.0).unwrap() * 10,
                    )
                })
                .collect(),
        })
    }

    pub async fn make_order(&self, order: MakeOrderRequest) -> CallResult<()> {
        let get_account_response: CallResult<(Account, String, Nat, [u8; 32])> = make_c2c_call(
            self.dex_canister_id,
            "getTxAccount",
            self.this_canister_id.to_string(),
            candid::encode_one,
            |r| candid::decode_args(r),
        )
        .await;

        let (account, nonce) = get_account_response.map(|(a, _, n, _)| (a, n))?;

        let (ledger_canister_id, amount) = match order.order_type {
            OrderType::Bid => (self.icp_ledger_canister_id, order.amount * order.price / 100_000_000),
            OrderType::Ask => (self.chat_ledger_canister_id, order.amount),
        };
        icrc1_ledger_canister_c2c_client::icrc1_transfer(
            ledger_canister_id,
            &TransferArg {
                from_subaccount: None,
                to: account,
                fee: None,
                created_at_time: None,
                memo: None,
                amount: amount.into(),
            },
        )
        .await?
        .map_err(|t| (RejectionCode::Unknown, format!("{t:?}")))?;

        let quantity = match order.order_type {
            OrderType::Bid => OrderQuantity::Buy(order.amount.into(), 0.into()),
            OrderType::Ask => OrderQuantity::Sell(order.amount.into()),
        };
        // Convert the price per whole CHAT into the price per `unit_size` of CHAT
        let price = (order.price * self.unit_size / 100_000_000).into();

        type TradeArgs = (
            OrderPrice,
            ICDexOrderType,
            Option<u128>,
            Option<Nat>,
            Option<[u8; 32]>,
            Option<Vec<u8>>,
        );

        let args: TradeArgs = (
            OrderPrice { price, quantity },
            ICDexOrderType::Limit,
            None,
            Some(nonce),
            None,
            None,
        );

        make_c2c_call(self.dex_canister_id, "trade", args, candid::encode_args, |r| {
            candid::decode_args(r)
        })
        .await?;

        (self.on_order_made)(ICDEX_EXCHANGE_ID, order);
        Ok(())
    }

    pub async fn cancel_order(&self, order: CancelOrderRequest) -> CallResult<()> {
        let id = hex::decode(&order.id).unwrap();

        type CancelArgs = (Vec<u8>, Option<[u8; 32]>);

        let args: CancelArgs = (id, None);

        make_c2c_call(self.dex_canister_id, "cancelByTxid", args, candid::encode_args, |r| {
            candid::decode_args(r)
        })
        .await?;

        (self.on_order_cancelled)(ICDEX_EXCHANGE_ID, order);
        Ok(())
    }
}

#[async_trait]
impl Exchange for ICDexClient {
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

#[derive(CandidType, Deserialize)]
struct TrieList {
    data: Vec<(Vec<u8>, TradingOrder)>,
    total: Nat,
    #[serde(rename = "totalPage")]
    total_page: Nat,
}

#[derive(CandidType, Deserialize)]
struct StatsResponse {
    price: f64,
}

#[derive(CandidType, Debug)]
enum Side {
    Buy,
    Sell,
}

impl From<OrderType> for Side {
    fn from(value: OrderType) -> Self {
        match value {
            OrderType::Bid => Side::Buy,
            OrderType::Ask => Side::Sell,
        }
    }
}

#[derive(CandidType, Deserialize)]
struct TradingOrder {
    remaining: OrderPrice,
    txid: Vec<u8>,
}

impl From<TradingOrder> for Order {
    fn from(value: TradingOrder) -> Self {
        let (order_type, amount) = match value.remaining.quantity {
            OrderQuantity::Buy(n, _) => (OrderType::Bid, n),
            OrderQuantity::Sell(n) => (OrderType::Ask, n),
        };
        let price: u64 = value.remaining.price.0.try_into().unwrap();
        Order {
            order_type,
            id: hex::encode(value.txid),
            price: price * 10, // TODO remove the '* 10' once fixed on their side
            amount: amount.0.try_into().unwrap(),
        }
    }
}

#[derive(CandidType, Deserialize)]
enum OrderQuantity {
    Buy(Nat, Nat),
    Sell(Nat),
}

#[derive(CandidType, Deserialize)]
struct OrderPrice {
    price: Nat,
    quantity: OrderQuantity,
}

#[derive(CandidType, Deserialize)]
enum MakeOrderResponse {
    #[serde(rename = "ok")]
    Ok(MakeOrderSuccess),
    #[serde(rename = "err")]
    Err(MakeOrderError),
}

#[derive(CandidType, Deserialize)]
struct MakeOrderSuccess {
    txid: Vec<u8>,
}

#[derive(CandidType, Deserialize, Debug)]
struct MakeOrderError {
    code: MakeOrderErrorCode,
    message: String,
}

#[derive(CandidType, Deserialize, Debug)]
enum MakeOrderErrorCode {
    NonceError,
    InvalidAmount,
    InsufficientBalance,
    TransferException,
    UnacceptableVolatility,
    TransactionBlocking,
    UndefinedError,
}

#[derive(CandidType, Serialize)]
enum ICDexOrderType {
    #[serde(rename = "LMT")]
    Limit,
}

#[derive(CandidType, Deserialize, Debug)]
struct Orderbook {
    ask: Vec<PriceAndQuantity>,
    bid: Vec<PriceAndQuantity>,
}

#[derive(CandidType, Deserialize, Debug)]
struct PriceAndQuantity {
    quantity: Nat,
    price: Nat,
}
