use crate::{RuntimeState, mutate_state};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::{info, trace};

const BATCH_SIZE: usize = 1000;
const MAX_INSTRUCTIONS_PER_RUN: u64 = 2_000_000_000;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// Moves the CHIT events which are still on the heap into stable memory. This can be removed once
// every canister has been migrated.
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && state.data.chit_events.on_heap_count() > 0 {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'migrate_chit_events_to_stable_memory' job running");
    TIMER_ID.set(None);
    mutate_state(|state| {
        let mut count = 0;
        loop {
            let moved = state.data.chit_events.migrate_to_stable_memory(BATCH_SIZE);
            count += moved;
            if moved < BATCH_SIZE || ic_cdk::api::instruction_counter() > MAX_INSTRUCTIONS_PER_RUN {
                break;
            }
        }
        let complete = !start_job_if_required(state);
        info!(count, complete, "Migrated CHIT events to stable memory");
    });
}
