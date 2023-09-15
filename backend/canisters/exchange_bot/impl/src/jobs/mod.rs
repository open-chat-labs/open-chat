use crate::RuntimeState;

pub mod edit_messages;

pub(crate) fn start(state: &RuntimeState) {
    edit_messages::start_job_if_required(state);
}
