use crate::RuntimeState;

pub mod upgrade_communities;
pub mod upgrade_groups;

pub(crate) fn start(state: &RuntimeState) {
    upgrade_communities::start_job_if_required(state);
    upgrade_groups::start_job_if_required(state);
}
