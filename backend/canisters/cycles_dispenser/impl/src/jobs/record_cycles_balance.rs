use crate::{mutate_state, read_state};
use constants::{DAY_IN_MS, HOUR_IN_MS};
use std::time::Duration;
use types::{Milliseconds, TimestampMillis};

// Records the cycles balance on the hour, or at midnight UTC in test mode, so that the samples are
// evenly spaced. Each run schedules the next from the time it actually ran, so they never drift.
pub fn start_job() {
    // The state isn't set up yet when the jobs are started
    ic_cdk_timers::set_timer(Duration::ZERO, async { schedule_next() });
}

fn schedule_next() {
    let delay = read_state(|state| delay_until_next_sample(state.env.now(), interval(state.data.test_mode)));
    ic_cdk_timers::set_timer(Duration::from_millis(delay), async { run() });
}

fn run() {
    mutate_state(|state| state.record_cycles_balance());
    schedule_next();
}

fn interval(test_mode: bool) -> Milliseconds {
    if test_mode { DAY_IN_MS } else { HOUR_IN_MS }
}

fn delay_until_next_sample(now: TimestampMillis, interval: Milliseconds) -> Milliseconds {
    interval - now % interval
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn next_sample_is_on_the_next_hour() {
        assert_eq!(delay_until_next_sample(5 * HOUR_IN_MS + 1, HOUR_IN_MS), HOUR_IN_MS - 1);
        assert_eq!(delay_until_next_sample(6 * HOUR_IN_MS - 1, HOUR_IN_MS), 1);
    }

    #[test]
    fn sample_taken_on_the_hour_schedules_the_next_an_hour_later() {
        assert_eq!(delay_until_next_sample(5 * HOUR_IN_MS, HOUR_IN_MS), HOUR_IN_MS);
    }

    #[test]
    fn next_sample_in_test_mode_is_at_midnight() {
        assert_eq!(
            delay_until_next_sample(3 * DAY_IN_MS + 5 * HOUR_IN_MS, interval(true)),
            19 * HOUR_IN_MS
        );
    }
}
