use crate::RuntimeState;

pub mod sync_events_to_user_canisters;
pub mod sync_events_to_user_index_canister;
pub mod topup_canister_pool;
pub mod upgrade_canisters;

pub(crate) fn start(runtime_state: &RuntimeState) {
    sync_events_to_user_canisters::start_job_if_required(runtime_state);
    sync_events_to_user_index_canister::start_job_if_required(runtime_state);
    topup_canister_pool::start_job_if_required(runtime_state);
    upgrade_canisters::start_job_if_required(runtime_state);
}
