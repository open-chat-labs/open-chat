use crate::RuntimeState;

pub mod ensure_sufficient_active_buckets;

pub(crate) fn start(_state: &RuntimeState) {
    ensure_sufficient_active_buckets::start_job();
}
