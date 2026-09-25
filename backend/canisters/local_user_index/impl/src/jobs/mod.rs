use crate::RuntimeState;

pub mod aggregate_top_ups;
pub mod check_media_scan_stall;
pub mod delete_users;
pub mod moderate_messages;
pub mod pull_daily_puzzle;
pub mod refresh_chunk_store;
pub mod refund_cycles;
pub mod topup_canister_pool;
pub mod topup_canisters;
pub mod upgrade_communities;
pub mod upgrade_groups;
pub mod upgrade_multi_users;
pub mod upgrade_users;

pub(crate) fn start(state: &RuntimeState) {
    aggregate_top_ups::start_job();
    check_media_scan_stall::start_job();
    delete_users::start_job_if_required(state, None);
    moderate_messages::start_job_if_required(state);
    pull_daily_puzzle::start_job();
    refresh_chunk_store::start_job();
    refund_cycles::start_job_if_required(state, None);
    topup_canister_pool::start_job_if_required(state, None);
    topup_canisters::start_job();
    upgrade_communities::start_job_if_required(state);
    upgrade_groups::start_job_if_required(state);
    upgrade_multi_users::start_job_if_required(state);
    upgrade_users::start_job_if_required(state);
}
