use crate::guards::caller_is_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_set_user_suspended::*;
use oc_error_codes::OCErrorCode;

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_set_user_suspended(args: Args) -> Response {
    execute_update(|state| c2c_set_user_suspended_impl(args, state))
}

fn c2c_set_user_suspended_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    if state
        .data
        .chat
        .members
        .set_suspended(args.user_id, args.suspended, now)
        .is_some()
    {
        Response::Success
    } else {
        Response::Error(OCErrorCode::TargetUserNotInChat.into())
    }
}
