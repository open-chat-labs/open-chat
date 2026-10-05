use crate::{RuntimeState, mutate_state};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::info;

const MAX_INSTRUCTIONS_PER_RUN: u64 = 5_000_000_000;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// Makes the queued accessor replacements, a migrated user's old id being replaced by their new one,
// stopping each run once it has used its share of instructions
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && state.data.files.accessor_replacements_queued() {
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
        let mut replacements = 0;
        let mut files = 0;
        while let Some(replaced) = state.data.files.make_next_accessor_replacement() {
            replacements += 1;
            files += replaced;
            if ic_cdk::api::instruction_counter() > MAX_INSTRUCTIONS_PER_RUN {
                break;
            }
        }
        let complete = !start_job_if_required(state);
        info!(replacements, files, complete, "Replaced accessors");
    });
}
