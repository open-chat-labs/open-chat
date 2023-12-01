use crate::RuntimeState;

pub mod make_pending_payments;

pub(crate) fn start(state: &RuntimeState) {
    make_pending_payments::start_job_if_required(state);
}
