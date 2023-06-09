use crate::memory::{get_orders_log_data_memory, get_orders_log_index_memory};
use ic_stable_structures::{StableLog, Storable};
use market_maker_canister::{CancelOrderRequest, ExchangeId, MakeOrderRequest};
use msgpack::{deserialize_then_unwrap, serialize_then_unwrap};
use serde::{Deserialize, Serialize};
use stable_memory::Memory;
use std::borrow::Cow;
use std::fmt::{Display, Formatter};
use types::TimestampMillis;

#[derive(Serialize, Deserialize)]
pub struct OrdersLog {
    #[serde(skip, default = "init_log")]
    log: StableLog<LogEntry, Memory, Memory>,
}

impl OrdersLog {
    pub fn log_order_made(&mut self, exchange_id: ExchangeId, order: MakeOrderRequest, now: TimestampMillis) {
        self.log(exchange_id, Action::OrderMade(order), now);
    }

    pub fn log_order_cancelled(&mut self, exchange_id: ExchangeId, order: CancelOrderRequest, now: TimestampMillis) {
        self.log(exchange_id, Action::OrderCancelled(order), now);
    }

    pub fn iter(&self) -> impl Iterator<Item = LogEntry> + '_ {
        self.log.iter()
    }

    pub fn len(&self) -> u64 {
        self.log.len()
    }

    fn log(&mut self, exchange_id: ExchangeId, action: Action, now: TimestampMillis) {
        self.log
            .append(&LogEntry {
                timestamp: now,
                exchange_id,
                action,
            })
            .unwrap();
    }
}

fn init_log() -> StableLog<LogEntry, Memory, Memory> {
    let index_memory = get_orders_log_index_memory();
    let data_memory = get_orders_log_data_memory();

    StableLog::init(index_memory, data_memory).unwrap()
}

impl Default for OrdersLog {
    fn default() -> Self {
        OrdersLog { log: init_log() }
    }
}

#[derive(Serialize, Deserialize)]
pub struct LogEntry {
    timestamp: TimestampMillis,
    exchange_id: ExchangeId,
    action: Action,
}

#[derive(Serialize, Deserialize)]
enum Action {
    OrderMade(MakeOrderRequest),
    OrderCancelled(CancelOrderRequest),
}

impl Storable for LogEntry {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serialize_then_unwrap(self))
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        deserialize_then_unwrap(bytes.as_ref())
    }
}

impl Display for LogEntry {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let timestamp = self.timestamp;
        let exchange_id = self.exchange_id;

        let msg = match &self.action {
            Action::OrderMade(o) => {
                let order_type = o.order_type;
                let price = o.price as f64 / 100000000f64;
                let amount = o.amount as f64 / 100000000f64;

                format!("Order made. Type: {order_type}. Price: {price}. Amount: {amount}")
            }
            Action::OrderCancelled(o) => {
                format!("Order cancelled. Id: {}", o.id)
            }
        };

        write!(f, "{timestamp} ExchangeId: {exchange_id}. {msg}")
    }
}
