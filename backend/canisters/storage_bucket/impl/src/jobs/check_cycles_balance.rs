use crate::check_cycles_balance;
use constants::DAY_IN_MS;
use std::time::Duration;
use utils::canister_timers::run_now_then_interval;

const INTERVAL: Duration = Duration::from_millis(DAY_IN_MS);

pub fn start_job() {
    run_now_then_interval(INTERVAL, check_cycles_balance);
}
