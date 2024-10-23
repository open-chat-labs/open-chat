use crate::RuntimeState;

pub mod garbage_collect_stable_memory;

pub(crate) fn start(state: &RuntimeState) {
    garbage_collect_stable_memory::start_job_if_required(state);
}
