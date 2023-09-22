use crate::RuntimeState;

pub mod import_groups;

pub(crate) fn start(state: &RuntimeState) {
    import_groups::start_job_if_required(state);
}
