use crate::RuntimeState;

pub mod execute_airdrop;

pub(crate) fn start(state: &RuntimeState) {
    execute_airdrop::start_job_if_required(state);
}
