use crate::{mutate_state, RuntimeState};
use constants::MINUTE_IN_MS;
use std::time::Duration;
use types::Milliseconds;
use utils::canister_timers::run_now_then_interval;

const CALCULATE_METRICS_INTERVAL: Milliseconds = 5 * MINUTE_IN_MS;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(CALCULATE_METRICS_INTERVAL), run);
}

fn run() {
    mutate_state(calculate_metrics_impl);
}

fn calculate_metrics_impl(state: &mut RuntimeState) {
    let now = state.env.now();
    state.data.calculate_metrics(now);
}
