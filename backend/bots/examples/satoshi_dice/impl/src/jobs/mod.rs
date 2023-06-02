use crate::RuntimeState;

pub mod process_pending_actions;

pub(crate) fn start(state: &RuntimeState) {
    process_pending_actions::start_job_if_required(state);
}
