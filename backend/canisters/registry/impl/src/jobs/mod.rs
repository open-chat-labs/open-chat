use crate::RuntimeState;

pub mod check_for_sns_updates;

pub(crate) fn start(_state: &RuntimeState) {
    check_for_sns_updates::start_job();
}
