use crate::guards::caller_is_user_index;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_grant_super_admin::*;

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_grant_super_admin(args: Args) -> Response {
    mutate_state(|state| set_platform_moderator(args.user_id, true, state))
}

// Traps for a user who isn't in this canister, rather than letting the UserIndex go on to record
// a change which was never applied
pub(crate) fn set_platform_moderator(
    user_id: types::UserId,
    is_platform_moderator: bool,
    state: &mut RuntimeState,
) -> Response {
    let user_index = state
        .index_of_local_user(user_id)
        .unwrap_or_else(|| ic_cdk::trap("User not found"));
    state
        .data
        .users
        .with_user_mut(user_index, |user| user.is_platform_moderator = is_platform_moderator)
        .unwrap_or_else(|| ic_cdk::trap("User not found"));
    Response::Success
}
