use crate::RuntimeState;

mod retrieve_proposals;
pub mod update_finished_proposals;

pub(crate) fn start(state: &RuntimeState) {
    retrieve_proposals::start_job();
    update_finished_proposals::start_job_if_required(state);
}
