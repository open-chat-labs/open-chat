use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index_or_local_user_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_invite_users::{Response::*, *};
use group_chat_core::InvitedUsersResult;

#[update_msgpack(guard = "caller_is_user_index_or_local_user_index")]
#[trace]
fn c2c_invite_users(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_invite_users_impl(args, state))
}

fn c2c_invite_users_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let now = state.env.now();

    match state.data.invite_users(args.caller, args.users, now) {
        InvitedUsersResult::Success(r) => {
            if !state.data.chat.is_public {
                handle_activity_notification(state);
            }
            Success(SuccessResult {
                invited_users: r.invited_users,
                group_name: r.group_name,
            })
        }
        InvitedUsersResult::UserNotInGroup => CallerNotInGroup,
        InvitedUsersResult::NotAuthorized => NotAuthorized,
        InvitedUsersResult::UserSuspended => NotAuthorized,
        InvitedUsersResult::TooManyInvites(v) => TooManyInvites(v),
    }
}
