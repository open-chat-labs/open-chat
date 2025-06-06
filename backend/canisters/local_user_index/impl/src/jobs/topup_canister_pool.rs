use crate::{CHILD_CANISTER_INITIAL_CYCLES_BALANCE, RuntimeState, mutate_state, read_state};
use constants::{CREATE_CANISTER_CYCLES_FEE, min_cycles_balance};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, Cycles};
use utils::canister::create;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState, delay: Option<Duration>) -> bool {
    if TIMER_ID.get().is_none() && !state.data.canister_pool.is_full() {
        let timer_id = ic_cdk_timers::set_timer(delay.unwrap_or_default(), run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'topup_canister_pool' job running");
    TIMER_ID.set(None);

    let (is_full, test_mode) = read_state(|state| (is_pool_full(state), state.data.test_mode));
    if !is_full {
        let cycles_to_use = CHILD_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;

        // Only create the new canister if it won't result in the cycles balance being too low
        if utils::cycles::can_spend_cycles(cycles_to_use, min_cycles_balance(test_mode)) {
            ic_cdk::futures::spawn(add_new_canister(cycles_to_use));
        } else {
            read_state(|state| start_job_if_required(state, Some(Duration::from_secs(300))));
        }
    }
}

fn is_pool_full(state: &RuntimeState) -> bool {
    state.data.canister_pool.is_full()
}

async fn add_new_canister(cycles_to_use: Cycles) {
    if let Ok(canister_id) = create(cycles_to_use, None).await {
        mutate_state(|state| add_canister_to_pool(canister_id, cycles_to_use, state));
    }
    read_state(|state| start_job_if_required(state, None));
}

fn add_canister_to_pool(canister_id: CanisterId, cycles: Cycles, state: &mut RuntimeState) {
    state.data.canister_pool.push(canister_id);
    state.data.total_cycles_spent_on_canisters += cycles;
}
