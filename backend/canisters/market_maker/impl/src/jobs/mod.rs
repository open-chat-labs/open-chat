use crate::RuntimeState;

pub mod run_market_maker;

pub(crate) fn start(_state: &RuntimeState) {
    run_market_maker::start_job();
}
