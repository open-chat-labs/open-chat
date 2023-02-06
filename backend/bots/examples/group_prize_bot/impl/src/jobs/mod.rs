use crate::RuntimeState;

mod send_prizes;

pub(crate) fn start(runtime_state: &RuntimeState) {
    send_prizes::start_job(runtime_state);
}
