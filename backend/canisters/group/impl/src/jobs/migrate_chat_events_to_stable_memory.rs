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

// Moves the chat events data which is still on the heap (each chat's MessageId -> EventIndex map,
// its expiring events and its events' last updated timestamps) into stable memory. This can be
// removed once every canister has been migrated.
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && state.data.chat.events.heap_entries_to_migrate_count() > 0 {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'migrate_chat_events_to_stable_memory' job running");
    TIMER_ID.set(None);
    mutate_state(|state| {
        let mut count = 0;
        'outer: for events in std::iter::once(&mut state.data.chat.events) {
            loop {
                let moved = events.migrate_to_stable_memory(BATCH_SIZE);
                count += moved;
                if ic_cdk::api::instruction_counter() > MAX_INSTRUCTIONS_PER_RUN {
                    break 'outer;
                }
                if moved < BATCH_SIZE {
                    break;
                }
            }
        }
        let complete = !start_job_if_required(state);
        info!(count, complete, "Migrated chat events data to stable memory");
    });
}
