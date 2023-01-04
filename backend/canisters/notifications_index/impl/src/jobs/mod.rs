use crate::RuntimeState;

pub mod sync_notifications_canisters;
pub mod upgrade_canisters;

pub(crate) fn start(runtime_state: &RuntimeState) {
    sync_notifications_canisters::start_job_if_required(runtime_state);
    upgrade_canisters::start_job_if_required(runtime_state);
}
