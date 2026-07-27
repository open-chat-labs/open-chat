use crate::{RuntimeState, mutate_state};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::info;
use types::TimestampMillis;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
    static NEXT_EXPIRY: Cell<Option<TimestampMillis>> = Cell::default();
}

// Deletes vaulted blobs whose retention period has passed (and which are not under legal hold).
// The vault's access log records each deletion and survives it.
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    let next_expiry = state.data.vault.next_retention_expiry();

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
        for hash in state.data.vault.remove_expired(now) {
            state.data.files.vault_unpin(&hash);
            info!("Vault: blob removed at retention expiry");
        }
        start_job_if_required(state);
    });
}
