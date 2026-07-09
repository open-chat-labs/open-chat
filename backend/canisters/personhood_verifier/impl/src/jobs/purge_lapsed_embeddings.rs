use crate::{RuntimeState, mutate_state};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::info;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// Deletes all embeddings of a lapsed model version once the re-verification
// window closes. Re-armed on every upgrade from jobs::start, so the deadline
// survives canister upgrades.
pub(crate) fn start_job_if_required(state: &RuntimeState) {
    if TIMER_ID.get().is_some() {
        return;
    }
    let Some((_, deadline)) = state.data.lapsed_embedding_purge else {
        return;
    };
    let now = state.env.now();
    let delay = Duration::from_millis(deadline.saturating_sub(now));
    let timer_id = ic_cdk_timers::set_timer(delay, run);
    TIMER_ID.set(Some(timer_id));
}

pub(crate) fn restart_job(state: &RuntimeState) {
    if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
    }
    start_job_if_required(state);
}

fn run() {
    TIMER_ID.set(None);
    mutate_state(|state| {
        if let Some((version, deadline)) = state.data.lapsed_embedding_purge {
            if deadline <= state.env.now() {
                let removed = state.data.embeddings.remove_version(version);
                state.data.lapsed_embedding_purge = None;
                info!(version, removed, "Purged embeddings of lapsed model version");
            } else {
                start_job_if_required(state);
            }
        }
    });
}
