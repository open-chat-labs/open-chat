use crate::RuntimeState;

pub mod check_cycles_balance;
pub mod remove_accessors;
pub mod remove_expired_files;
pub mod remove_old_pending_files;
pub mod replace_accessors;
pub mod vault_retention;

pub(crate) fn start(state: &RuntimeState) {
    check_cycles_balance::start_job();
    remove_expired_files::start_job_if_required(state);
    remove_accessors::start_job_if_required(state);
    remove_old_pending_files::start_job();
    replace_accessors::start_job_if_required(state);
    vault_retention::start_job_if_required(state);
}
