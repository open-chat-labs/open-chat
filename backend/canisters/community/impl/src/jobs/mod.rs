use crate::RuntimeState;

pub mod import_groups;
pub mod make_pending_payments;

pub(crate) fn start(state: &RuntimeState) {
    import_groups::start_job_if_required(state);
    make_pending_payments::start_job_if_required(state);
}
