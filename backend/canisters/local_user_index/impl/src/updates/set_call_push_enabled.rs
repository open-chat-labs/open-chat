use crate::guards::caller_is_platform_operator;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::set_call_push_enabled::*;

// The native call push kill switch (#9456). Off, every push is what it was before native calls.
#[update(guard = "caller_is_platform_operator", candid = true, msgpack = true)]
#[trace]
fn set_call_push_enabled(args: Args) -> Response {
    mutate_state(|state| set_call_push_enabled_impl(args, state))
}

fn set_call_push_enabled_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.call_push_enabled = args.enabled;
    Response::Success
}
