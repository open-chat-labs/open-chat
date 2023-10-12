use std::time::Duration;

pub fn run_now_then_interval(interval: Duration, func: fn()) {
    ic_cdk_timers::set_timer_interval(interval, func);
    ic_cdk_timers::set_timer(Duration::ZERO, func);
}
