use crate::RuntimeState;

pub mod garbage_collect_stable_memory;

pub(crate) fn start(state: &RuntimeState) {
    // Nothing may change the state of a canister whose user is being migrated
    if state.data.is_migrating() {
        return;
    }
    garbage_collect_stable_memory::start_job_if_required(&state.data);
}
