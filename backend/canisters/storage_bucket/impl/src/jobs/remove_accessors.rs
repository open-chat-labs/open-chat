use crate::model::index_event_batch::EventToSync;
use crate::{RuntimeState, mutate_state};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::info;

const MAX_INSTRUCTIONS_PER_RUN: u64 = 5_000_000_000;
// Removing a file can mean deleting a blob of up to 100MB, so the instructions used are checked
// after each one
const MAX_FILES_PER_STEP: usize = 1;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// Removes the queued accessors, those of deleted groups and communities, from the files naming them,
// removing each file which is left with no accessors, and stopping each run once it has used its
// share of instructions
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && state.data.files.accessor_removals_queued() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    TIMER_ID.set(None);
    mutate_state(|state| {
        let mut files_removed = 0;
        while let Some(removed) = state.data.files.remove_next_queued_accessor(MAX_FILES_PER_STEP) {
            files_removed += removed.len();
            for file in removed {
                state.data.push_event_to_index(EventToSync::FileRemoved(file));
            }
            if ic_cdk::api::instruction_counter() > MAX_INSTRUCTIONS_PER_RUN {
                break;
            }
        }
        let complete = !start_job_if_required(state);
        if files_removed > 0 || !complete {
            info!(files_removed, complete, "Removed accessors");
        }
    });
}
