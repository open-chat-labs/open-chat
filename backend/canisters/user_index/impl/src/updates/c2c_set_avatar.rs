use crate::guards::caller_is_openchat_user_or_multi_user_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_index_canister::c2c_set_avatar::{Response::*, *};

#[update(guard = "caller_is_openchat_user_or_multi_user_canister", msgpack = true)]
#[trace]
fn c2c_set_avatar(args: Args) -> Response {
    mutate_state(|state| c2c_set_avatar_impl(args, state))
}

fn c2c_set_avatar_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    // A MultiUser canister names which of its users this is for, anyone else sets their own
    let user_id = args.user_id.unwrap_or(caller.into());
    if user_id.canister_id() != caller {
        return Error(OCErrorCode::InitiatorNotAuthorized.into());
    }
    let now = state.env.now();

    match state.data.users.set_avatar_id(&user_id, args.avatar_id, now) {
        true => Success,
        false => UserNotFound,
    }
}
