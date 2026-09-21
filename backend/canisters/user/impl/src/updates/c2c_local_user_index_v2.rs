use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_local_user_index_v2::*;

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_local_user_index_v2(args: Args) -> Response {
    execute_update(|state| c2c_local_user_index_v2_impl(args, state))
}

// Only the events for this canister's own user apply
fn c2c_local_user_index_v2_impl(args: Args, state: &mut RuntimeState) -> Response {
    let my_user_id = state.env.canister_id().into();
    let events = args
        .events
        .into_iter()
        .filter(|(user_id, _)| *user_id == my_user_id)
        .map(|(_, event)| event)
        .collect();

    super::c2c_local_user_index::handle_events(events, state)
}
