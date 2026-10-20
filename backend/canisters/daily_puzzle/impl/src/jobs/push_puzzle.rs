//! Delivers the current day's puzzles to every LocalUserIndex, as a `DailyPuzzleEvent::Puzzles` on the
//! queue to each index, which calls its `c2c_daily_puzzle` (see `LocalIndexEventBatch`). A refresh
//! re-reads the indexes from the registry first. The queue retries a failed send in order, and drops one
//! an hour old: every index pulls for itself every 15 minutes while it holds no puzzle for the day, so a
//! push is only ever the fast path. An index which missed a set receives it ahead of any later one, and
//! its idempotency check drops a set sent again after a later one landed.

use crate::{RuntimeState, mutate_state, read_state, registry};
use ic_cdk_timers::TimerId;
use local_user_index_canister::DailyPuzzleEvent;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info};

const RETRY_DELAY: Duration = Duration::from_secs(60);

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// `pending_pushes` is only ever non-empty in state from before the queue: the indexes still owed the
// day's set then, which this push covers
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.pending_pushes.is_empty() {
        schedule(false, Duration::ZERO);
        true
    } else {
        false
    }
}

pub(crate) fn schedule(refresh: bool, delay: Duration) {
    if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
    }
    let timer_id = ic_cdk_timers::set_timer(delay, run(refresh));
    TIMER_ID.set(Some(timer_id));
}

async fn run(refresh: bool) {
    TIMER_ID.set(None);
    push(refresh).await;
}

async fn push(refresh: bool) {
    if refresh && let Err(error) = registry::refresh_local_user_indexes().await {
        error!(?error, "Failed to refresh local user indexes from the registry");
        if read_state(|state| state.data.local_user_indexes.is_empty()) {
            schedule(true, RETRY_DELAY);
            return;
        }
    }

    mutate_state(|state| {
        state.data.pending_pushes.clear();

        let now = state.env.now();
        let puzzles: Vec<_> = state.data.current_puzzles(now).into_iter().cloned().collect();
        let Some(number) = puzzles.first().map(|p| p.number) else {
            // Nothing for the current number: the gap between `regenerate_today` dropping today's puzzle
            // and its replacement being generated, which pushes again once it has been. Sets queued for
            // an index earlier stay queued.
            return;
        };
        let games = puzzles.len();

        let indexes: Vec<_> = state.data.local_user_indexes.iter().copied().collect();
        for canister_id in &indexes {
            state.push_event_to_local_index(*canister_id, DailyPuzzleEvent::Puzzles(puzzles.clone()));
        }
        info!(
            number,
            games,
            indexes = indexes.len(),
            "Queued puzzles for the local user indexes"
        );
    });
}
