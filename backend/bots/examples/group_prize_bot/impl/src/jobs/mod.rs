use crate::RuntimeState;

pub mod send_prizes;

pub(crate) fn start(state: &mut RuntimeState) {
    send_prizes::start_job(state);
}
