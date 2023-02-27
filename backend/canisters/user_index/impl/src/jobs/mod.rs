use crate::RuntimeState;

pub mod dismiss_super_admins;
pub mod set_users_suspended;
pub mod upgrade_canisters;

pub(crate) fn start(runtime_state: &RuntimeState) {
    dismiss_super_admins::start_job_if_required(runtime_state);
    set_users_suspended::start_job_if_required(runtime_state);
    upgrade_canisters::start_job_if_required(runtime_state);
}
