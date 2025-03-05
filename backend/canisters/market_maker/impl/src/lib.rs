#![allow(deprecated)]
use crate::exchanges::Exchange;
use crate::model::orders_log::OrdersLog;
use canister_state_macros::canister_state;
use constants::{CHAT_SYMBOL, ICP_SYMBOL};
use icdex_client::ICDexClient;
use market_maker_canister::{ExchangeId, ICDEX_EXCHANGE_ID, ICDEX_EXCHANGE_V2_ID};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap, VecDeque};
use types::{
    AggregatedOrders, BuildVersion, CancelOrderRequest, CanisterId, Cryptocurrency, Cycles, MakeOrderRequest, TimestampMillis,
    Timestamped, TokenInfo,
};
use utils::env::Environment;

mod exchanges;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
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
            ICDEX_EXCHANGE_ID => Some(self.create_icdex_client(
                ICDEX_EXCHANGE_ID,
                CanisterId::from_text("3we4s-lyaaa-aaaak-aegrq-cai").unwrap(),
            )),
            ICDEX_EXCHANGE_V2_ID => Some(self.create_icdex_client(
                ICDEX_EXCHANGE_V2_ID,
                CanisterId::from_text("52ypw-riaaa-aaaar-qadjq-cai").unwrap(),
            )),
            _ => None,
        }
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            exchanges: self.data.exchange_config.clone(),
            latest_orders_taken: self.data.latest_orders_taken.clone(),
            my_open_orders: self.data.my_open_orders.clone(),
            market_makers_in_progress: self.data.market_makers_in_progress.clone(),
            stable_memory_sizes: memory::memory_sizes(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
                icp_ledger: self.data.icp_ledger_canister_id,
                chat_ledger: self.data.chat_ledger_canister_id,
            },
        }
    }

    fn create_icdex_client(&self, exchange_id: ExchangeId, dex_canister_id: CanisterId) -> Box<dyn Exchange> {
        Box::new(ICDexClient::new(
            self.env.canister_id(),
            dex_canister_id,
            TokenInfo {
                symbol: ICP_SYMBOL.to_string(),
                token: Cryptocurrency::InternetComputer,
                ledger: self.data.icp_ledger_canister_id,
                decimals: 8,
                fee: 10_000,
            },
            TokenInfo {
                symbol: CHAT_SYMBOL.to_string(),
                token: Cryptocurrency::CHAT,
                ledger: self.data.chat_ledger_canister_id,
                decimals: 8,
                fee: 100_000,
            },
            10_000_000,
            move |order| on_order_made(exchange_id, order),
            move |order| on_order_cancelled(exchange_id, order),
        ))
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
    pub latest_orders_taken: HashMap<ExchangeId, (Option<u64>, Option<u64>)>,
    pub my_open_orders: HashMap<ExchangeId, AggregatedOrders>,
    pub market_makers_in_progress: HashMap<ExchangeId, TimestampMillis>,
    pub balance_history: VecDeque<CanisterBalances>,
    pub rng_seed: [u8; 32],
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
            latest_orders_taken: HashMap::default(),
            my_open_orders: HashMap::new(),
            market_makers_in_progress: HashMap::new(),
            balance_history: VecDeque::new(),
            rng_seed: [0; 32],
            test_mode,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub exchanges: HashMap<ExchangeId, Config>,
    pub latest_orders_taken: HashMap<ExchangeId, (Option<u64>, Option<u64>)>,
    pub my_open_orders: HashMap<ExchangeId, AggregatedOrders>,
    pub market_makers_in_progress: HashMap<ExchangeId, TimestampMillis>,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
    pub icp_ledger: CanisterId,
    pub chat_ledger: CanisterId,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Config {
    enabled: bool,
    price_increment: u64,
    order_size: u64,
    min_order_size: u64,
    max_buy_price: u64,
    min_sell_price: u64,
    spread: u64,
    min_orders_per_direction: u32,
    max_orders_per_direction: u32,
    max_orders_to_make_per_iteration: u32,
    max_orders_to_cancel_per_iteration: u32,
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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CanisterBalances {
    pub timestamp: TimestampMillis,
    pub balances: BTreeMap<CanisterId, u128>,
}
