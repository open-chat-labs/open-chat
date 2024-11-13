use crate::RuntimeState;

pub mod topup_canister_pool;
pub mod topup_canisters;
pub mod upgrade_communities;
pub mod upgrade_groups;

pub(crate) fn start(state: &RuntimeState) {
    topup_canister_pool::start_job_if_required(state, None);
    topup_canisters::start_job();
    upgrade_communities::start_job_if_required(state);
    upgrade_groups::start_job_if_required(state);
}
