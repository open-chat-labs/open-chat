use crate::RuntimeState;

pub mod calculate_balances;
pub mod run_market_maker;

pub(crate) fn start(_state: &RuntimeState) {
    calculate_balances::start_job();
    run_market_maker::start_job();
}
