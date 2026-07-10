use crate::jobs::process_verifications::notify_user_index;
use crate::{mutate_state, read_state};
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

    // Retry any proof notifications user_index hasn't acknowledged yet. Each
    // clears itself from the set on success; c2c_notify_personhood_verified is
    // idempotent, so a duplicate delivery is harmless.
    let (user_index_canister_id, pending) = read_state(|state| {
        (
            state.data.user_index_canister_id,
            state.data.pending_verified_notifications.clone(),
        )
    });
    for (user_id, model_version) in pending {
        ic_cdk::futures::spawn(notify_user_index(user_index_canister_id, user_id, model_version));
    }
}
