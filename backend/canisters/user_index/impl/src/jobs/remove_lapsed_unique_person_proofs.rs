use crate::{RuntimeState, mutate_state};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::info;
use types::{UniquePersonProofProvider, UserId};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

const BATCH_SIZE: usize = 500;

// Removes unique person proofs that are no longer valid, fanning each removal
// out to the local user indexes and user canisters. Covers two cases:
// - legacy DecideAI-provider proofs (the one-off cutover wipe)
// - OpenChat-provider proofs issued against an embedding model version that
//   has lapsed following a model upgrade
// The job is stateless and idempotent: each execution rescans for up to
// BATCH_SIZE affected users, so it survives upgrades mid-sweep.
pub(crate) fn start_job_if_required(state: &RuntimeState) {
    if TIMER_ID.get().is_some() {
        return;
    }
    let now = state.env.now();
    let delay = match state.data.personhood_model_lapse {
        Some(lapse) if lapse.lapses_at > now => Duration::from_millis(lapse.lapses_at - now),
        _ => Duration::ZERO,
    };
    let timer_id = ic_cdk_timers::set_timer(delay, run);
    TIMER_ID.set(Some(timer_id));
}

// Re-arms the timer after a new lapse announcement (cancelling any pending)
pub(crate) fn restart_job(state: &RuntimeState) {
    if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
    }
    start_job_if_required(state);
}

fn run() {
    TIMER_ID.set(None);
    let more = mutate_state(run_batch);
    if more {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
    }
}

fn run_batch(state: &mut RuntimeState) -> bool {
    let now = state.env.now();
    let lapse = state.data.personhood_model_lapse.filter(|lapse| lapse.lapses_at <= now);

    let to_remove: Vec<UserId> = state
        .data
        .users
        .iter()
        .filter(|user| {
            user.unique_person_proof.as_ref().is_some_and(|proof| match proof.provider {
                UniquePersonProofProvider::DecideAI => true,
                UniquePersonProofProvider::OpenChat => {
                    lapse.is_some_and(|lapse| proof.model_version.unwrap_or(0) < lapse.new_version)
                }
            })
        })
        .map(|user| user.user_id)
        .take(BATCH_SIZE)
        .collect();

    let count = to_remove.len();
    for user_id in to_remove {
        state.remove_unique_person_proof(user_id);
    }
    if count > 0 {
        info!(count, "Removed lapsed unique person proofs");
    }

    if count == BATCH_SIZE {
        true
    } else {
        // Sweep complete: retire the lapse marker so future scans are cheap
        if lapse.is_some() {
            state.data.personhood_model_lapse = None;
        }
        false
    }
}
