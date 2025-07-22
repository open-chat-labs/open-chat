use crate::RuntimeState;

pub mod upgrade_buckets;

pub(crate) fn start(state: &RuntimeState) {
    upgrade_buckets::start_job_if_required(state);
}
