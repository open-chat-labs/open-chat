use crate::{RuntimeState, mutate_state};
use candid::Principal;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::CanisterId;
use utils::canister::{set_controllers, should_retry_failed_c2c_call};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.update_controllers_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'update_controllers' job running");

    if let Some((canister_id, controllers)) = mutate_state(|state| {
        state
            .data
            .update_controllers_queue
            .pop_front()
            .map(|c| (c, vec![state.data.local_user_index_canister_id, state.env.canister_id()]))
    }) {
        ic_cdk::futures::spawn(run_single(canister_id, controllers));
    } else if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
    }
}

async fn run_single(canister_id: CanisterId, controllers: Vec<Principal>) {
    if let Err(error) = set_controllers(canister_id, controllers).await {
        if should_retry_failed_c2c_call(error.reject_code(), error.message()) {
            mutate_state(|state| {
                state.data.update_controllers_queue.push_back(canister_id);
                start_job_if_required(state);
            });
        }
    }
}
