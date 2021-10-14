use candid::Principal;
use std::cell::RefCell;
use types::{CanisterId, Cycles, TimestampMillis};

mod check_cycles_balance;
mod top_up_canister;

pub use check_cycles_balance::check_cycles_balance;
pub use top_up_canister::top_up_canister;

thread_local! {
    static STATE: RefCell<State> = RefCell::default();
}

struct State {
    initialized: bool,
    low_balance_threshold: Cycles,
    top_up_canister_id: CanisterId,
    in_progress: bool,
    last_notified: TimestampMillis,
}

impl State {
    pub fn new(low_balance_threshold: Cycles, top_up_canister_id: CanisterId) -> State {
        State {
            initialized: true,
            low_balance_threshold,
            top_up_canister_id,
            in_progress: false,
            last_notified: 0,
        }
    }
}

impl Default for State {
    fn default() -> Self {
        State {
            initialized: false,
            low_balance_threshold: 0,
            top_up_canister_id: Principal::anonymous(),
            in_progress: false,
            last_notified: 0,
        }
    }
}

pub fn init_cycles_balance_checker(low_balance_threshold: Cycles, top_up_canister_id: CanisterId) {
    STATE.with(|state| {
        if state.borrow().initialized {
            panic!("State already initialized");
        }
        *state.borrow_mut() = State::new(low_balance_threshold, top_up_canister_id);
    });
}
