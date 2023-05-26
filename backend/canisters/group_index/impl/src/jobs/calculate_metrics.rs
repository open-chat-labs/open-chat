use crate::{mutate_state, RuntimeState};
use std::time::Duration;
use types::Milliseconds;
use utils::time::MINUTE_IN_MS;

const CALCULATE_METRICS_INTERVAL: Milliseconds = 5 * MINUTE_IN_MS;

pub fn start_job() {
    ic_cdk_timers::set_timer_interval(Duration::from_millis(CALCULATE_METRICS_INTERVAL), run);
}

fn run() {
    mutate_state(calculate_metrics_impl);
}

fn calculate_metrics_impl(state: &mut RuntimeState) {
    let now = state.env.now();
    state.data.calculate_metrics(now);
}
