//! Delivers the current day's puzzles to every LocalUserIndex, as a `DailyPuzzleEvent::Puzzles` on the
//! queue to each index, which calls its `c2c_daily_puzzle` (see `LocalIndexEventBatch`). A refresh
//! re-reads the indexes from the registry first. The queue retries a failed send in order, and drops one
//! an hour old: every index pulls for itself every 15 minutes while it holds no puzzle for the day, so a
//! push is only ever the fast path. Each push replaces any set still queued for an index, and the
//! index's idempotency check drops a set sent again after a later one landed.

use crate::{mutate_state, read_state, registry};
use ic_cdk_timers::TimerId;
use local_user_index_canister::DailyPuzzleEvent;
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info};

const RETRY_DELAY: Duration = Duration::from_secs(60);

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
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
            // Each set replaces the last, so one still queued for the index is dropped rather than
            // sent ahead of this one, where its age could have this one dropped with it. A set already
            // being sent is left alone.
            state.data.local_index_event_sync_queue.take(canister_id);
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
