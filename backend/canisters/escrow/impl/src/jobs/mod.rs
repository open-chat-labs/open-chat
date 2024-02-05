use crate::RuntimeState;

pub mod make_pending_payments;
pub mod notify_status_change;

pub(crate) fn start(state: &RuntimeState) {
    make_pending_payments::start_job_if_required(state);
    notify_status_change::start_job_if_required(state);
}
