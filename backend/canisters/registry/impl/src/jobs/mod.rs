use crate::RuntimeState;

pub mod check_for_sns_updates;
pub mod check_for_updates_to_supported_standards;

pub(crate) fn start(_state: &RuntimeState) {
    check_for_sns_updates::start_job();
    check_for_updates_to_supported_standards::start_job();
}
