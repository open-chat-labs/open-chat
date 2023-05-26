use crate::RuntimeState;
pub mod make_pending_payments;
pub mod notify_user_principal_migrations;
pub mod sync_events_to_local_user_index_canisters;
pub mod sync_users_to_storage_index;
pub mod upgrade_canisters;

pub(crate) fn start(state: &RuntimeState) {
    notify_user_principal_migrations::start_job_if_required(state);
    sync_events_to_local_user_index_canisters::start_job_if_required(state);
    sync_users_to_storage_index::start_job_if_required(state);
    upgrade_canisters::start_job_if_required(state);
    make_pending_payments::start_job_if_required(state);
}
