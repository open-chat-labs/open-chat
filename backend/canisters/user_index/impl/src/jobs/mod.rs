use crate::RuntimeState;

pub mod set_users_suspended;
pub mod upgrade_canisters;

pub(crate) fn start(runtime_state: &RuntimeState) {
    set_users_suspended::start_job_if_required(runtime_state);
    upgrade_canisters::start_job_if_required(runtime_state);
}
