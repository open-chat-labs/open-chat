use crate::RuntimeState;

pub mod sync_notifications_canisters;
pub mod upgrade_canisters;

pub(crate) fn start(state: &RuntimeState) {
    sync_notifications_canisters::start_job_if_required(state);
    upgrade_canisters::start_job_if_required(state);
}
