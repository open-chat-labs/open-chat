use crate::RuntimeState;

pub mod calculate_active_users;

pub(crate) fn start(_state: &RuntimeState) {
    calculate_active_users::start_job();
}
