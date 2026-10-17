use crate::guards::caller_is_multi_user_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_index_canister::c2c_set_avatar::{Response::*, *};

// No longer called, but still served until every MultiUser canister is on a version which sends
// `UserSetAvatar` via its LocalUserIndex instead, after which this is removed
#[update(guard = "caller_is_multi_user_canister", msgpack = true)]
#[trace]
fn c2c_set_avatar(args: Args) -> Response {
    mutate_state(|state| c2c_set_avatar_impl(args, state))
}

fn c2c_set_avatar_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let user_id = args.user_id;
    if user_id.canister_id() != caller {
        return Error(OCErrorCode::InitiatorNotAuthorized.into());
    }
    let now = state.env.now();

    match state.data.users.set_avatar_id(&user_id, args.avatar_id, now) {
        true => Success,
        false => UserNotFound,
    }
}
