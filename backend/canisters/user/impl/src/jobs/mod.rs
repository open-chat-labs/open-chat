use crate::RuntimeState;

// Each job (other than the one-off migrations) runs the regular jobs before doing its work, since
// they include checking the cycles balance, which would otherwise only happen as updates are handled.
// So a canister which is busy with background work but receiving few updates still asks to be topped
// up before it runs out of cycles.

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
