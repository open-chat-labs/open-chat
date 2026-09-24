use crate::RuntimeState;

pub mod garbage_collect_stable_memory;
pub mod migrate_chat_events_to_stable_memory;
pub mod migrate_direct_chat_events_to_key_id_keys;

pub(crate) fn start(state: &RuntimeState) {
    // Nothing may change the state of a canister whose user is being migrated
    if state.data.is_migrating() {
        return;
    }
    garbage_collect_stable_memory::start_job_if_required(&state.data);
    migrate_chat_events_to_stable_memory::start_job_if_required(state);
}
