use crate::RuntimeState;

pub mod generate_candidates;
pub mod push_puzzle;
pub mod rollover;

pub(crate) fn start(state: &RuntimeState) {
    rollover::arm(state);
    generate_candidates::start_job_if_required(state);
    push_puzzle::start_job_if_required(state);
}
