use crate::model::index_sync_state::EventToSync;
use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use types::TimestampMillis;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
    static NEXT_EXPIRY: Cell<Option<TimestampMillis>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    let next_expiry = state.data.files.next_expiry();

    // If the next expiry has changed, reset the timer with the new expiry
    if NEXT_EXPIRY.replace(next_expiry) != next_expiry {
        if let Some(timer_id) = TIMER_ID.take() {
            ic_cdk_timers::clear_timer(timer_id);
        }
        if let Some(expiry) = next_expiry {
            let delay = Duration::from_millis(expiry.saturating_sub(state.env.now()));
            let timer_id = ic_cdk_timers::set_timer(delay, run);
            TIMER_ID.set(Some(timer_id));
            return true;
        }
    }
    false
}

fn run() {
    mutate_state(|state| {
        let now = state.env.now();
        for file in state.data.files.remove_expired_files(now, 10) {
            state.data.push_event_to_index(EventToSync::FileRemoved(file));
        }
        start_job_if_required(state);
    });
}
