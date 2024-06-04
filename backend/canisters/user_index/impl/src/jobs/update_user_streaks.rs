use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{Milliseconds, TimestampMillis};

const MS_IN_DAY: Milliseconds = 1000 * 60 * 60 * 24;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() {
        let now = state.env.now();
        let timer_id = ic_cdk_timers::set_timer(time_until_midnight(now), run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'update_user_streaks' job running");
    TIMER_ID.set(None);

    mutate_state(|state| {
        let now = state.env.now();
        state.data.users.update_streaks(now);

        let timer_id = ic_cdk_timers::set_timer(time_until_midnight(now), run);
        TIMER_ID.set(Some(timer_id));
    });
}

fn time_until_midnight(now: TimestampMillis) -> Duration {
    Duration::from_millis(MS_IN_DAY - (now % MS_IN_DAY))
}
