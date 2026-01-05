use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_index_canister::mark_subscription_active::*;
use stable_memory_map::StableMemoryMap;

#[update(msgpack = true)]
#[trace]
fn mark_subscription_active(args: Args) -> Response {
    mutate_state(|state| mark_subscription_active_impl(args, state))
}

fn mark_subscription_active_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    if let Some(user_id) = state.data.principal_to_user_id_map.get(&caller) {
        state
            .data
            .subscriptions
            .mark_active(&user_id, &args.endpoint, state.env.now());
    }
    Response::Success
}
