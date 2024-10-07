use crate::RuntimeState;

pub mod delete_users;
pub mod sync_events_to_user_index_canister;
pub mod topup_canister_pool;
pub mod upgrade_canisters;

pub(crate) fn start(state: &RuntimeState) {
    delete_users::start_job_if_required(state, None);
    sync_events_to_user_index_canister::start_job_if_required(state);
    topup_canister_pool::start_job_if_required(state);
    upgrade_canisters::start_job_if_required(state);
}
