use crate::RuntimeState;
pub mod fetch_users_last_online;
pub mod make_pending_payments;
pub mod remove_from_online_users_canister;
pub mod reset_leaderboard;
pub mod sync_events_to_local_user_index_canisters;
pub mod sync_users_to_identity_canister;
pub mod upgrade_canisters;

pub(crate) fn start(state: &RuntimeState) {
    fetch_users_last_online::start_job_if_required(state);
    make_pending_payments::start_job_if_required(state);
    remove_from_online_users_canister::start_job_if_required(state);
    sync_events_to_local_user_index_canisters::start_job_if_required(state);
    sync_users_to_identity_canister::start_job_if_required(state);
    upgrade_canisters::start_job_if_required(state);
    reset_leaderboard::start_job_if_required(state);
}
