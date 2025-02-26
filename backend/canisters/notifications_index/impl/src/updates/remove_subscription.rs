use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_index_canister::remove_subscription::{Response::*, *};
use stable_memory_map::StableMemoryMap;

#[update(msgpack = true)]
#[trace]
fn remove_subscription(args: Args) -> Response {
    mutate_state(|state| remove_subscription_impl(args, state))
}

fn remove_subscription_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    if let Some(user_id) = state.data.principal_to_user_id_map.get(&caller) {
        state.remove_subscription(user_id, args.p256dh_key, state.env.now());
    }
    Success
}
