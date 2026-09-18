use crate::guards::caller_is_local_multi_user_canister;
use crate::updates::c2c_user_canister::handle_event;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_multi_user_canister::*;
use std::cell::LazyCell;

// The MultiUser canister's counterpart to `c2c_user_canister`. Each event names the user it is from,
// which must be one of the users the calling canister hosts.
#[update(guard = "caller_is_local_multi_user_canister", msgpack = true)]
#[trace]
fn c2c_multi_user_canister(args: ArgsInternal) -> Response {
    mutate_state(|state| c2c_multi_user_canister_impl(args, state))
}

fn c2c_multi_user_canister_impl(args: ArgsInternal, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = LazyCell::new(now_millis);
    for event in args.events {
        if event.value.user_id.canister_id() != caller {
            continue;
        }
        if state
            .data
            .idempotency_checker
            .check(caller, event.created_at, event.idempotency_id)
        {
            handle_event(event.value.user_id, event.value.event, &now, state);
        }
    }
    Response::Success
}
