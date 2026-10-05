use per_round_timer::PerRoundTimer;
use std::cell::RefCell;
use std::time::Duration;

thread_local! {
    // The timers run for the lifetime of the canister, so are never dropped
    static TIMERS: RefCell<Vec<PerRoundTimer>> = RefCell::default();
}

pub fn run_now_then_interval(interval: Duration, func: fn()) {
    ic_cdk_timers::set_timer(Duration::ZERO, async move { func() });
    run_interval(interval, func);
}

pub fn run_interval(interval: Duration, func: fn()) {
    TIMERS.with_borrow_mut(|timers| timers.push(PerRoundTimer::new_with_interval(interval, func)));
}
