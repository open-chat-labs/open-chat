use crate::RuntimeState;

pub mod dismiss_super_admins;
pub mod notify_user_principal_migrations;
pub mod set_users_suspended;
pub mod sync_events_to_local_user_index_canisters;
pub mod sync_users_to_storage_index;
pub mod upgrade_canisters;

pub(crate) fn start(runtime_state: &RuntimeState) {
    dismiss_super_admins::start_job_if_required(runtime_state);
    notify_user_principal_migrations::start_job_if_required(runtime_state);
    set_users_suspended::start_job_if_required(runtime_state);
    sync_events_to_local_user_index_canisters::start_job_if_required(runtime_state);
    sync_users_to_storage_index::start_job_if_required(runtime_state);
    upgrade_canisters::start_job_if_required(runtime_state);
}
