use crate::RuntimeState;

pub mod upgrade_canisters;

pub(crate) fn start(runtime_state: &RuntimeState) {
    upgrade_canisters::start_job_if_required(runtime_state);
}
