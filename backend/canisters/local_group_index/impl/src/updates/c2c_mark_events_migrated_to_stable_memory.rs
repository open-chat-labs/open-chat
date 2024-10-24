use crate::guards::caller_is_local_group_or_community_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_group_index_canister::c2c_mark_events_migrated_to_stable_memory::Args;

#[update(guard = "caller_is_local_group_or_community_canister", msgpack = true)]
#[trace]
fn c2c_mark_events_migrated_to_stable_memory(_args: Args) {
    mutate_state(c2c_mark_events_migrated_to_stable_memory_impl)
}

fn c2c_mark_events_migrated_to_stable_memory_impl(state: &mut RuntimeState) {
    let caller = state.env.caller();
    state
        .data
        .canisters_pending_events_migration_to_stable_memory
        .retain(|c| *c != caller);
}
