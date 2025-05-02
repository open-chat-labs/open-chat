use crate::RuntimeState;

pub mod update_controllers;
pub mod upgrade_communities;
pub mod upgrade_groups;

pub(crate) fn start(state: &RuntimeState) {
    update_controllers::start_job_if_required(state);
    upgrade_communities::start_job_if_required(state);
    upgrade_groups::start_job_if_required(state);
}
