use crate::RuntimeState;

mod check_for_nervous_system_updates;
pub(crate) mod increase_dissolve_delay;
mod push_proposals;
mod retrieve_proposals;
mod update_finished_proposals;
mod update_proposals;

pub(crate) fn start(state: &RuntimeState) {
    check_for_nervous_system_updates::start_job();
    increase_dissolve_delay::start_job_if_required(state);
    push_proposals::start_job_if_required(state);
    retrieve_proposals::start_job(state);
    update_finished_proposals::start_job_if_required(state);
    update_proposals::start_job_if_required(state);
}
