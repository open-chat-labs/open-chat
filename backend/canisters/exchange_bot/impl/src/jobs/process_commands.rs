use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;

const MAX_BATCH_SIZE: usize = 10;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.with(|t| t.get().is_none()) && !state.data.commands_pending.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.with(|t| t.set(Some(timer_id)));
        trace!("'process_commands' job started");
        true
    } else {
        false
    }
}

fn run() {
    if mutate_state(process_next_batch) == 0 {
        if let Some(timer_id) = TIMER_ID.with(|t| t.take()) {
            ic_cdk_timers::clear_timer(timer_id);
            trace!("'process_commands' job stopped");
        }
    }
}

fn process_next_batch(state: &mut RuntimeState) -> usize {
    let mut count = 0;
    while let Some(next) = state.data.commands_pending.pop_next_for_processing() {
        next.process(state);
        count += 1;
        if count == MAX_BATCH_SIZE {
            break;
        }
    }
    count
}
