use crate::guards::caller_is_local_user_or_multi_user_canister;
use crate::updates::c2c_user_canister::handle_event;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_user_canister_v2::*;
use std::cell::LazyCell;
use types::UserId;

// Takes events from both User and MultiUser canisters. Each event names the user it is from, which
// for a User canister must be itself, and for a MultiUser canister must be one of the users it hosts.
#[update(guard = "caller_is_local_user_or_multi_user_canister", msgpack = true)]
#[trace]
fn c2c_user_canister_v2(args: ArgsInternal) -> Response {
    mutate_state(|state| c2c_user_canister_v2_impl(args, state))
}

fn c2c_user_canister_v2_impl(args: ArgsInternal, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let caller_is_multi_user_canister = state.is_caller_local_multi_user_canister();
    let now = LazyCell::new(now_millis);
    for event in args.events {
        let user_id = event.value.user_id;
        if !is_valid_user_for_caller(user_id, caller, caller_is_multi_user_canister) {
            continue;
        }
        if state
            .data
            .idempotency_checker
            .check(caller, event.created_at, event.idempotency_id)
        {
            handle_event(user_id, event.value.event, &now, state);
        }
    }
    Response::Success
}

fn is_valid_user_for_caller(user_id: UserId, caller: candid::Principal, caller_is_multi_user_canister: bool) -> bool {
    if caller_is_multi_user_canister {
        // A user hosted by the caller carries a non-zero index, which rules out the canister's own
        // id (index 0)
        user_id.index() != 0 && user_id.canister_id() == caller
    } else {
        user_id == UserId::from(caller)
    }
}
