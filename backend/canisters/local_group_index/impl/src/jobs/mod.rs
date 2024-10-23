use crate::RuntimeState;

pub mod upgrade_groups;

pub(crate) fn start(state: &RuntimeState) {
    upgrade_groups::start_job_if_required(state);
}
