use crate::RuntimeState;

mod remove_expired_temp_keys;

pub(crate) fn start(_state: &RuntimeState) {
    remove_expired_temp_keys::start_job();
}
