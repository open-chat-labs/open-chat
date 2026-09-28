use crate::RuntimeState;

pub mod garbage_collect_stable_memory;
pub mod import_users;

pub(crate) fn start(state: &RuntimeState) {
    garbage_collect_stable_memory::start_job_if_required(&state.data);
    import_users::start_job_if_required(state);
}
