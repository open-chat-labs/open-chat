use crate::RuntimeState;

pub mod execute_airdrop;
pub mod process_pending_actions;

pub(crate) fn start(state: &RuntimeState) {
    execute_airdrop::start_job_if_required(state);
    process_pending_actions::start_job_if_required(state);
}
