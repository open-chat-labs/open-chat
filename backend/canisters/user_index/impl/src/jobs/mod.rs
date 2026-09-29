use crate::RuntimeState;
pub mod cancel_stalled_user_migrations;
pub mod fetch_users_last_online;
pub mod make_pending_payments;
pub mod reset_leaderboard;
pub mod start_user_migrations;
pub mod sync_events_to_local_user_index_canisters;
pub mod sync_users_to_identity_canister;
pub mod upgrade_canisters;

pub(crate) fn start(state: &RuntimeState) {
    cancel_stalled_user_migrations::start_job_if_required(state);
    fetch_users_last_online::start_job_if_required(state);
    make_pending_payments::start_job_if_required(state);
    sync_events_to_local_user_index_canisters::start_job_if_required(state);
    sync_users_to_identity_canister::start_job_if_required(state);
    upgrade_canisters::start_job_if_required(state);
    reset_leaderboard::start_job_if_required(state);
}
