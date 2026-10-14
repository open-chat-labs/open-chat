use crate::RuntimeState;

// Each job runs the regular jobs before doing its work, since they include checking the cycles
// balance, which would otherwise only happen as updates are handled. So a canister which is busy with
// background work but receiving few updates still asks to be topped up before it runs out of cycles.

pub mod garbage_collect_stable_memory;
pub mod migrate_their_user_ids;
pub mod rewrite_direct_chats;
pub mod update_user_ids_in_events;

pub(crate) fn start(state: &RuntimeState) {
    garbage_collect_stable_memory::start_job_if_required(&state.data);
    migrate_their_user_ids::start_job_if_required(state);
    rewrite_direct_chats::start_job_if_required(state);
    update_user_ids_in_events::start_job_if_required(state);
}
