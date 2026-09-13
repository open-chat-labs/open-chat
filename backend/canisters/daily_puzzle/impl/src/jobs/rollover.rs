//! One-shot timer re-armed to the next of 00:00 and 12:00 UTC. At 00:00 today's puzzle ships
//! from its candidate pool; both firings top up tomorrow's pool.

use crate::jobs::{generate_candidates, push_puzzle};
use crate::{RuntimeState, mutate_state, read_state};
use constants::HOUR_IN_MS;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::info;
use types::TimestampMillis;

const HALF_DAY_IN_MS: u64 = 12 * HOUR_IN_MS;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn next_boundary(now: TimestampMillis) -> TimestampMillis {
    (now / HALF_DAY_IN_MS + 1) * HALF_DAY_IN_MS
}

pub(crate) fn arm(state: &RuntimeState) {
    if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
    }
    let now = state.env.now();
    let delay = next_boundary(now).saturating_sub(now);
    let timer_id = ic_cdk_timers::set_timer(Duration::from_millis(delay), async { run() });
    TIMER_ID.set(Some(timer_id));
}

fn run() {
    TIMER_ID.set(None);
    mutate_state(|state| {
        let now = state.env.now();
        let promoted = state.data.ensure_puzzles(now);
        info!(number = crate::Data::number_for(now), promoted, "Rollover");
        if promoted {
            push_puzzle::schedule(true, Duration::ZERO);
        }
        generate_candidates::start_job_if_required(state);
    });
    read_state(arm);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn next_boundary_is_midnight_or_noon() {
        assert_eq!(next_boundary(0), HALF_DAY_IN_MS);
        assert_eq!(next_boundary(HALF_DAY_IN_MS - 1), HALF_DAY_IN_MS);
        assert_eq!(next_boundary(HALF_DAY_IN_MS), 2 * HALF_DAY_IN_MS);
        assert_eq!(next_boundary(HALF_DAY_IN_MS + 5), 2 * HALF_DAY_IN_MS);
    }
}
