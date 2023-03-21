use async_trait::async_trait;
use candid::utils::ArgumentEncoder;
use candid::{CandidType, Nat, Principal};
use exchange_client_canister::cancel_orders::Args as CancelOrdersArgs;
use exchange_client_canister::make_orders::Args as MakeOrdersArgs;
use exchange_client_canister::{CancelOrderRequest, MakeOrderRequest, OrderType, ICDEX_EXCHANGE_ID};
use ic_agent::Agent;
use market_maker_core::{Exchange, Order, Stats};
use serde::de::DeserializeOwned;
use serde::Deserialize;
use std::fmt::Debug;
use std::time::Duration;

pub struct ICDex {
    agent: Agent,
    dex_canister_id: Principal,
    trader_canister_id: Principal,
}

impl ICDex {
    pub fn new(agent: Agent, dex_canister_id: Principal, trader_canister_id: Principal) -> Self {
        ICDex {
            agent,
            dex_canister_id,
            trader_canister_id,
        }
    }

    async fn latest_price(&self) -> Result<u64, String> {
        let response: StatsResponse = query(&self.agent, &self.dex_canister_id, "stats", ()).await?;

        Ok((response.price * 100000000f64) as u64)
    }

    async fn open_orders(&self) -> Result<Vec<Order>, String> {
        let orders: TrieList = query(
            &self.agent,
            &self.dex_canister_id,
            "pending",
            (self.trader_canister_id.to_string(), Option::<Nat>::None, Option::<Nat>::None),
        )
        .await?;

        Ok(orders.data.into_iter().map(|(_, o)| o.into()).collect())
    }

    async fn make_order(&self, order: MakeOrderRequest) -> Result<(), String> {
        let args = MakeOrdersArgs {
            exchange_id: ICDEX_EXCHANGE_ID,
            orders: vec![order],
        };

        exchange_client_canister_client::make_orders(&self.agent, &self.trader_canister_id, &args)
            .await
            .map_err(|e| format!("{e:?}"))?;

        Ok(())
    }

    async fn cancel_order(&self, order: CancelOrderRequest) -> Result<(), String> {
        let args = CancelOrdersArgs {
            exchange_id: ICDEX_EXCHANGE_ID,
            orders: vec![order],
        };

        exchange_client_canister_client::cancel_orders(&self.agent, &self.trader_canister_id, &args)
            .await
            .map_err(|e| format!("{e:?}"))?;

        Ok(())
    }
}

#[async_trait]
impl Exchange for ICDex {
    async fn stats(&self) -> Result<Stats, String> {
        let open_orders = self.open_orders().await?;
        let latest_price = self.latest_price().await?;

        Ok(Stats {
            latest_price,
            open_orders,
        })
    }

    async fn make_orders(&self, orders: Vec<MakeOrderRequest>) -> Result<(), String> {
        for order in orders {
            self.make_order(order).await?;
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
        Ok(())
    }

    async fn cancel_orders(&self, orders: Vec<CancelOrderRequest>) -> Result<(), String> {
        for order in orders {
            self.cancel_order(order).await?;
            tokio::time::sleep(Duration::from_secs(2)).await;
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

async fn query<A: ArgumentEncoder + Debug, R: CandidType + DeserializeOwned>(
    agent: &Agent,
    canister_id: &Principal,
    method_name: &str,
    args: A,
) -> Result<R, String> {
    agent
        .query(canister_id, method_name)
        .with_arg(candid::encode_args(args).unwrap())
        .call()
        .await
        .map(|r| candid::decode_one::<R>(&r).unwrap())
        .map_err(|e| e.to_string())
}
