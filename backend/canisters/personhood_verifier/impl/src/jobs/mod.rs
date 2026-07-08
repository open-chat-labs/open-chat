use crate::RuntimeState;

pub mod process_verifications;
pub mod prune_sessions;

pub(crate) fn start(state: &RuntimeState) {
    process_verifications::start_job_if_required(state);
    prune_sessions::start_job();
}
