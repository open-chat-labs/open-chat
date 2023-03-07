use crate::RuntimeState;

pub mod send_prizes;

pub(crate) fn start(runtime_state: &mut RuntimeState) {
    send_prizes::start_job(runtime_state);
}
