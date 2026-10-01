use crate::RuntimeState;

pub mod get_transactions;

pub(crate) fn start(state: &RuntimeState) {
    get_transactions::start_job_if_required(state);
}
