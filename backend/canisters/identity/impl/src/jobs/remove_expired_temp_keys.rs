use crate::mutate_state;
use constants::DAY_IN_MS;
use std::time::Duration;
use types::Milliseconds;
use utils::canister_timers::run_now_then_interval;

const INTERVAL: Milliseconds = DAY_IN_MS;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(INTERVAL), run);
}

fn run() {
    mutate_state(|state| state.data.user_principals.remove_expired_temp_keys(state.env.now()));
}
