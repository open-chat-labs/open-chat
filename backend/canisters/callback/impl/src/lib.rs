use crate::model::callbacks::Callbacks;
use candid::CandidType;
use canister_logger::LogMessagesWrapper;
use canister_state_macros::canister_state;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use types::{Cycles, TimestampMillis, Timestamped, Version};
use utils::env::Environment;
use utils::memory;

mod lifecycle;
mod model;
mod queries;
mod updates;

thread_local! {
    static LOG_MESSAGES: RefCell<LogMessagesWrapper> = RefCell::default();
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

    pub fn metrics(&self) -> Metrics {
        let callback_metrics = self.data.callbacks.metrics();

        Metrics {
            memory_used: memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            callbacks_pending: callback_metrics.pending,
            callbacks_completed: callback_metrics.completed,
            callbacks_failed: callback_metrics.failed,
            next_callback_due: callback_metrics.next_callback_due,
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub callbacks: Callbacks,
    pub test_mode: bool,
}

impl Data {
    pub fn new(test_mode: bool) -> Data {
        Data {
            callbacks: Callbacks::default(),
            test_mode,
        }
    }
}

#[derive(CandidType, Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub callbacks_pending: u64,
    pub callbacks_completed: u64,
    pub callbacks_failed: u64,
    pub next_callback_due: TimestampMillis,
}
