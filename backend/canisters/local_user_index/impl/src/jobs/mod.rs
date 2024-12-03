use crate::RuntimeState;

pub mod delete_users;
pub mod topup_canister_pool;
pub mod topup_canisters;
pub mod upgrade_canisters;

pub(crate) fn start(state: &RuntimeState) {
    delete_users::start_job_if_required(state, None);
    topup_canister_pool::start_job_if_required(state, None);
    topup_canisters::start_job();
    upgrade_canisters::start_job_if_required(state);
}
