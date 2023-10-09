use crate::RuntimeState;

mod check_for_new_snses;
mod push_proposals;
mod retrieve_proposals;
mod update_finished_proposals;
mod update_proposals;

pub(crate) fn start(state: &RuntimeState) {
    check_for_new_snses::start_job();
    push_proposals::start_job_if_required(state);
    retrieve_proposals::start_job();
    update_finished_proposals::start_job_if_required(state);
    update_proposals::start_job_if_required(state);
}
