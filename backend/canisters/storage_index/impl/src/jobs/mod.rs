use crate::RuntimeState;

mod backfill_files;
mod check_active_buckets;
mod reconcile_files;
pub mod upgrade_buckets;

pub(crate) fn start(state: &RuntimeState) {
    check_active_buckets::start_job();
    upgrade_buckets::start_job_if_required(state);
    reconcile_files::start_job_if_required(state);
    backfill_files::start_job_if_required(state);
}
