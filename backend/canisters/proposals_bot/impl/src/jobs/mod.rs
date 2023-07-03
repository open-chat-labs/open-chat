use crate::RuntimeState;

pub mod update_finished_proposals;

pub(crate) fn start(state: &RuntimeState) {
    update_finished_proposals::start_job_if_required(state);
}
