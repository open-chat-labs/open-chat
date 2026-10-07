use crate::RuntimeState;

mod check_active_buckets;
pub mod upgrade_buckets;

pub(crate) fn start(state: &RuntimeState) {
    check_active_buckets::start_job();
    upgrade_buckets::start_job_if_required(state);
}
