use crate::guards::caller_is_local_user_canister;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk::update;
use local_user_index_canister::push_events::Args;

#[update(guard = "caller_is_local_user_canister")]
#[trace]
fn c2c_mark_events_migrated_to_stable_memory(_args: Args) {
    mutate_state(c2c_mark_events_migrated_to_stable_memory_impl)
}

fn c2c_mark_events_migrated_to_stable_memory_impl(state: &mut RuntimeState) {
    let caller = state.env.caller();
    state.data.canisters_pending_events_migration_to_stable_memory.remove(&caller);
}
