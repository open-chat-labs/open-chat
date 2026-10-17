use crate::guards::caller_is_user_index;
use crate::updates::c2c_notify_user_index_events::handle_event;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_user_index::*;
use std::cell::LazyCell;

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_user_index(args: Args) -> Response {
    mutate_state(|state| c2c_user_index_impl(args, state))
}

fn c2c_user_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = LazyCell::new(now_millis);
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(state.data.user_index_canister_id, event.created_at, event.idempotency_id)
        {
            handle_event(event.value, &now, state);
        }
    }
    Response::Success
}
