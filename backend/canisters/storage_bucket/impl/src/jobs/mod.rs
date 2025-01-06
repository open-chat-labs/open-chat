use crate::RuntimeState;

pub mod calculate_freezing_limit;
pub mod check_cycles_balance;
mod migrate_data_to_stable_map;
pub mod remove_expired_files;

pub(crate) fn start(state: &RuntimeState) {
    calculate_freezing_limit::start_job();
    check_cycles_balance::start_job();
    migrate_data_to_stable_map::start_job();
    remove_expired_files::start_job_if_required(state);
}
