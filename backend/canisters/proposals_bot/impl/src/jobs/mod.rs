use crate::RuntimeState;

mod push_proposals;
mod retrieve_proposals;
mod update_finished_proposals;

pub(crate) fn start(state: &RuntimeState) {
    push_proposals::start_job_if_required(state);
    retrieve_proposals::start_job();
    update_finished_proposals::start_job_if_required(state);
}
