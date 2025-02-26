use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_index_canister::remove_subscriptions_for_user::{Response::*, *};
use stable_memory_map::StableMemoryMap;

#[update(msgpack = true)]
#[trace]
fn remove_subscriptions_for_user(_args: Args) -> Response {
    mutate_state(remove_subscriptions_for_user_impl)
}

fn remove_subscriptions_for_user_impl(state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    if let Some(user_id) = state.data.principal_to_user_id_map.get(&caller) {
        state.remove_all_subscriptions(user_id, state.env.now());
    }
    Success
}
