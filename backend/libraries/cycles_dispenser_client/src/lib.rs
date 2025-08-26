use ic_cdk_timers::TimerId;
use std::cell::{Cell, RefCell};
use std::time::Duration;
use tracing::{error, info};
use types::{CanisterId, Cycles, Milliseconds};

thread_local! {
    static CONFIG: RefCell<Option<Config>> = RefCell::default();
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub struct Config {
    cycles_dispenser_canister_id: CanisterId,
    min_cycles_balance: Cycles,
    interval: Milliseconds,
    on_success_callback: Box<dyn Fn(Cycles)>,
    on_error_callback: Box<dyn Fn(String)>,
}

impl Config {
    pub fn new(cycles_dispenser_canister_id: CanisterId) -> Self {
        Self {
            cycles_dispenser_canister_id,
            min_cycles_balance: 1_000_000_000_000, // 1T
            interval: 60 * 1000,                   // 1 minute
            on_success_callback: Box::new(empty_fn),
            on_error_callback: Box::new(empty_fn),
        }
    }

    pub fn with_min_cycles_balance(mut self, min_cycles_balance: Cycles) -> Self {
        self.min_cycles_balance = min_cycles_balance;
        self
    }

    pub fn with_interval(mut self, interval: Milliseconds) -> Self {
        self.interval = interval;
        self
    }

    pub fn on_success<F: Fn(Cycles) + 'static>(mut self, on_success: F) -> Self {
        self.on_success_callback = Box::new(on_success);
        self
    }

    pub fn on_error<F: Fn(String) + 'static>(mut self, on_error: F) -> Self {
        self.on_error_callback = Box::new(on_error);
        self
    }
}

pub fn start(config: Config) {
    let interval = config.interval;

    CONFIG.set(Some(config));

    let timer_id = ic_cdk_timers::set_timer_interval(Duration::from_millis(interval), run_once);

    if let Some(previous) = TIMER_ID.replace(Some(timer_id)) {
        ic_cdk_timers::clear_timer(previous);
    }
}

pub fn stop() -> bool {
    if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
        true
    } else {
        false
    }
}

fn run_once() {
    if let Some((min_cycles_balance, cycles_dispenser_canister_id)) = CONFIG.with_borrow(|config| {
        config
            .as_ref()
            .map(|c| (c.min_cycles_balance, c.cycles_dispenser_canister_id))
    }) {
        let cycles_balance = ic_cdk::api::canister_cycle_balance();

        if cycles_balance < min_cycles_balance {
            ic_cdk::futures::spawn(request_top_up(cycles_balance, cycles_dispenser_canister_id))
        }
    }
}

async fn request_top_up(cycles_balance: Cycles, cycles_dispenser_canister_id: CanisterId) {
    info!(cycles_balance, "Requesting cycles top up");

    let args = cycles_dispenser_canister::c2c_request_cycles::Args { amount: None };

    let response = cycles_dispenser_canister_c2c_client::c2c_request_cycles(cycles_dispenser_canister_id, &args).await;

    if let Ok(cycles_dispenser_canister::c2c_request_cycles::Response::Success(cycles)) = &response {
        info!(cycles, "Cycles topped up successfully");
        CONFIG.with_borrow(|config| {
            if let Some(on_success) = config.as_ref().map(|c| &c.on_success_callback) {
                (*on_success)(*cycles)
            }
        });
    } else {
        error!(?response, "Cycles top up failed");
        CONFIG.with_borrow(|config| {
            if let Some(on_error) = config.as_ref().map(|c| &c.on_error_callback) {
                (*on_error)(format!("{response:?}"))
            }
        });
    }
}

fn empty_fn<T>(_: T) {}
