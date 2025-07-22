use crate::RuntimeState;

mod check_active_buckets;
pub mod ensure_sufficient_active_buckets;
pub mod upgrade_buckets;

pub(crate) fn start(state: &RuntimeState) {
    check_active_buckets::start_job();
    ensure_sufficient_active_buckets::start_job_if_required(state);
    upgrade_buckets::start_job_if_required(state);
}
