use crate::{mutate_state, read_state, RuntimeState, USER_CANISTER_INITIAL_CYCLES_BALANCE};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, Cycles};
use utils::canister::create;
use utils::consts::{CREATE_CANISTER_CYCLES_FEE, MIN_CYCLES_BALANCE};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && !state.data.canister_pool.is_full() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'topup_canister_pool' job started");
        true
    } else {
        false
    }
}

fn run() {
    let is_full = read_state(is_pool_full);
    if !is_full {
        let cycles_to_use = USER_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;

        // Only create the new canister if it won't result in the cycles balance being too low
        if utils::cycles::can_spend_cycles(cycles_to_use, MIN_CYCLES_BALANCE) {
            ic_cdk::spawn(add_new_canister(cycles_to_use));
        }
    } else if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
        ic_cdk_timers::clear_timer(timer_id);
        trace!("'topup_canister_pool' job stopped");
    }
}

fn is_pool_full(state: &RuntimeState) -> bool {
    state.data.canister_pool.is_full()
}

async fn add_new_canister(cycles_to_use: Cycles) {
    if let Ok(canister_id) = create(cycles_to_use).await {
        mutate_state(|state| add_canister_to_pool(canister_id, cycles_to_use, state));
    }
}

fn add_canister_to_pool(canister_id: CanisterId, cycles: Cycles, state: &mut RuntimeState) {
    state.data.canister_pool.push(canister_id);
    state.data.total_cycles_spent_on_canisters += cycles;
}
