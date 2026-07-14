use crate::RuntimeState;
pub mod make_pending_payments;
pub mod purge_stale_biometric_data;
pub mod remove_from_online_users_canister;
pub mod remove_lapsed_unique_person_proofs;
pub mod reset_leaderboard;
pub mod submit_message_to_modclub;
pub mod sync_events_to_local_user_index_canisters;
pub mod sync_users_to_identity_canister;
pub mod upgrade_canisters;

pub(crate) fn start(state: &RuntimeState) {
    make_pending_payments::start_job_if_required(state);
    purge_stale_biometric_data::start_job_if_required(state);
    remove_from_online_users_canister::start_job_if_required(state);
    remove_lapsed_unique_person_proofs::start_job_if_required(state);
    submit_message_to_modclub::start_job_if_required(state);
    sync_events_to_local_user_index_canisters::start_job_if_required(state);
    sync_users_to_identity_canister::start_job_if_required(state);
    upgrade_canisters::start_job_if_required(state);
    reset_leaderboard::start_job_if_required(state);
}
