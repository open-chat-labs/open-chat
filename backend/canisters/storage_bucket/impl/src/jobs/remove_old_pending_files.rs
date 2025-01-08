use crate::mutate_state;
use constants::DAY_IN_MS;
use std::time::Duration;
use tracing::info;
use utils::canister_timers::run_now_then_interval;

pub(crate) fn start_job() {
    run_now_then_interval(Duration::from_millis(DAY_IN_MS), run);
}

fn run() {
    mutate_state(|state| {
        let cutoff = state.env.now().saturating_sub(DAY_IN_MS);
        let count = state.data.files.remove_old_pending_files(cutoff);
        info!(count, "Removed old pending files");
    });
}
