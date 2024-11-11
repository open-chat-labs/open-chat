use crate::RuntimeState;

pub mod migrate_events_to_stable_memory;
pub mod topup_canister_pool;
pub mod upgrade_communities;
pub mod upgrade_groups;

pub(crate) fn start(state: &RuntimeState) {
    migrate_events_to_stable_memory::start_job_if_required(state);
    topup_canister_pool::start_job_if_required(state, None);
    upgrade_communities::start_job_if_required(state);
    upgrade_groups::start_job_if_required(state);
}
