use crate::RuntimeState;

pub mod process_commands;
pub mod process_messages;

pub(crate) fn start(state: &RuntimeState) {
    process_messages::start_job_if_required(state);
    process_commands::start_job_if_required(state);
}
