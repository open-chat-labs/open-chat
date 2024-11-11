use crate::RuntimeState;

pub mod delete_users;
pub mod migrate_events_to_stable_memory;
pub mod topup_canister_pool;
pub mod upgrade_canisters;

pub(crate) fn start(state: &RuntimeState) {
    migrate_events_to_stable_memory::start_job_if_required(state);
    delete_users::start_job_if_required(state, None);
    topup_canister_pool::start_job_if_required(state, None);
    upgrade_canisters::start_job_if_required(state);
}
