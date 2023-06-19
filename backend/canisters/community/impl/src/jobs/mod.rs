pub mod import_groups;

use crate::RuntimeState;

pub(crate) fn start(state: &RuntimeState) {
    import_groups::start_job_if_required(state);
}
