use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use utils::time::MonthKey;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() {
        let now = state.env.now();
        let start_of_next_month = MonthKey::from_timestamp(now).next().start_timestamp();
        let timer_id = ic_cdk_timers::set_timer(Duration::from_millis(start_of_next_month), run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

pub fn run() {
    trace!("'reset_leaderboard' job running");
    TIMER_ID.set(None);

    mutate_state(|state| {
        state.data.chit_leaderboard.reset_this_month();
        start_job_if_required(state);
    });
}
