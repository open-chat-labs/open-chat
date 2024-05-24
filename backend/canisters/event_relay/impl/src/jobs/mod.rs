use crate::RuntimeState;

pub mod get_transactions;

pub(crate) fn start(_state: &RuntimeState) {
    get_transactions::start_job_if_required();
}
