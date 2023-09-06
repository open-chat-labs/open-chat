use candid::{CandidType, Nat};
use canister_client::make_c2c_call;
use ic_cdk::api::call::{CallResult, RejectionCode};
use serde::{Deserialize, Serialize};
use types::icrc1::{Account, TransferArg};
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

    pub async fn latest_price(&self) -> CallResult<u64> {
        let response: StatsResponse = make_c2c_call(self.dex_canister_id, "stats", (), candid::encode_args, |r| {
            candid::decode_one(r)
        })
        .await?;

        Ok((response.price * self.quote_token_units_per_whole() as f64) as u64)
    }

    pub async fn my_open_orders(&self) -> CallResult<Vec<Order>> {
        type OpenOrdersArgs = (String, Option<Nat>, Option<Nat>);

        let args: OpenOrdersArgs = (self.this_canister_id.to_string(), None, None);

        let orders: TrieList = make_c2c_call(self.dex_canister_id, "pending", args, candid::encode_args, |r| {
            candid::decode_one(r)
        })
        .await?;

        Ok(orders.data.into_iter().map(|(_, o)| self.convert_order(o)).collect())
    }

    pub async fn orderbook(&self) -> CallResult<AggregatedOrders> {
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
            OrderType::Bid => (
                self.quote_token.ledger,
                order.amount * order.price / self.base_token_units_per_whole(),
            ),
            OrderType::Ask => (self.base_token.ledger, order.amount),
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
        // Convert the price per whole into the price per `smallest_order_size`
        let price = (order.price * self.smallest_order_size / self.base_token_units_per_whole()).into();

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

        (self.on_order_made)(order);
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

        (self.on_order_cancelled)(order);
        Ok(())
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
