use crate::RuntimeState;

pub mod check_for_new_snses;

pub(crate) fn start(_state: &RuntimeState) {
    check_for_new_snses::start_job();
}
