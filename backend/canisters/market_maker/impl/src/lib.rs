use crate::exchanges::icdex::ICDexClient;
use crate::exchanges::Exchange;
use crate::model::orders_log::OrdersLog;
use canister_state_macros::canister_state;
use market_maker_canister::{CancelOrderRequest, ExchangeId, MakeOrderRequest, OrderType, ICDEX_EXCHANGE_ID};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap};
use types::{CanisterId, Cycles, TimestampMillis, Timestamped, Version};
use utils::env::Environment;

mod exchanges;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<Version>> = RefCell::default();
}

canister_state!(RuntimeState);

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn get_exchange_client(&self, exchange_id: ExchangeId) -> Option<Box<dyn Exchange>> {
        match exchange_id {
            ICDEX_EXCHANGE_ID => Some(Box::new(ICDexClient::new(
                self.env.canister_id(),
                CanisterId::from_text("3we4s-lyaaa-aaaak-aegrq-cai").unwrap(),
                self.data.icp_ledger_canister_id,
                self.data.chat_ledger_canister_id,
                10000000,
                on_order_made,
                on_order_cancelled,
            ))),
            _ => None,
        }
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            exchanges: self.data.exchange_config.clone(),
            my_open_orders: self.data.my_open_orders.clone(),
            market_makers_in_progress: self.data.market_makers_in_progress.clone(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
                icp_ledger: self.data.icp_ledger_canister_id,
                chat_ledger: self.data.chat_ledger_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub exchange_config: HashMap<ExchangeId, Config>,
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub icp_ledger_canister_id: CanisterId,
    pub chat_ledger_canister_id: CanisterId,
    pub orders_log: OrdersLog,
    #[serde(default)]
    pub my_open_orders: HashMap<ExchangeId, AggregatedOrders>,
    pub market_makers_in_progress: HashMap<ExchangeId, TimestampMillis>,
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        user_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        icp_ledger_canister_id: CanisterId,
        chat_ledger_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            exchange_config: HashMap::new(),
            user_index_canister_id,
            cycles_dispenser_canister_id,
            icp_ledger_canister_id,
            chat_ledger_canister_id,
            orders_log: OrdersLog::default(),
            my_open_orders: HashMap::new(),
            market_makers_in_progress: HashMap::new(),
            test_mode,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub git_commit_id: String,
    pub exchanges: HashMap<ExchangeId, Config>,
    pub my_open_orders: HashMap<ExchangeId, AggregatedOrders>,
    pub market_makers_in_progress: HashMap<ExchangeId, TimestampMillis>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
    pub icp_ledger: CanisterId,
    pub chat_ledger: CanisterId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MarketSnapshot {
    latest_price: u64,
    my_open_orders: Vec<Order>,
    orderbook: AggregatedOrders,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct AggregatedOrders {
    bids: BTreeMap<u64, u64>,
    asks: BTreeMap<u64, u64>,
}

impl From<&[Order]> for AggregatedOrders {
    fn from(orders: &[Order]) -> Self {
        let mut aggregated_orders = AggregatedOrders::default();
        for order in orders {
            aggregated_orders.add(order.order_type, order.price, order.amount);
        }
        aggregated_orders
    }
}

impl AggregatedOrders {
    pub fn add(&mut self, order_type: OrderType, price: u64, amount: u64) {
        match order_type {
            OrderType::Bid => *self.bids.entry(price).or_default() += amount,
            OrderType::Ask => *self.asks.entry(price).or_default() += amount,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Order {
    order_type: OrderType,
    id: String,
    price: u64,
    amount: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Config {
    enabled: bool,
    price_increment: u64,
    order_size: u64,
    min_order_size: u64,
    max_buy_price: u64,
    min_sell_price: u64,
    #[serde(default = "two")]
    spread: u64,
    min_orders_per_direction: u32,
    max_orders_per_direction: u32,
    max_orders_to_make_per_iteration: u32,
    max_orders_to_cancel_per_iteration: u32,
}

fn two() -> u64 {
    2
}

fn on_order_made(exchange_id: ExchangeId, order: MakeOrderRequest) {
    if can_borrow_state() {
        mutate_state(|state| {
            let now = state.env.now();
            state.data.orders_log.log_order_made(exchange_id, order, now);
        })
    }
}

fn on_order_cancelled(exchange_id: ExchangeId, order: CancelOrderRequest) {
    if can_borrow_state() {
        mutate_state(|state| {
            let now = state.env.now();
            state.data.orders_log.log_order_cancelled(exchange_id, order, now);
        })
    }
}
