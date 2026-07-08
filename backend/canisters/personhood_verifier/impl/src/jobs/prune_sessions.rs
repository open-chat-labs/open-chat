use crate::mutate_state;
use constants::MINUTE_IN_MS;
use std::time::Duration;
use utils::canister_timers::run_now_then_interval;

// Terminal session results stay pollable for a grace period past the deadline
const GRACE: u64 = 5 * MINUTE_IN_MS;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(MINUTE_IN_MS), run);
}

fn run() {
    mutate_state(|state| {
        let now = state.env.now();
        state.data.sessions.prune_expired(now, GRACE);
        let sessions = &state.data.sessions;
        state.data.processing_queue.retain(|id| sessions.get(*id).is_some());
    });
}
