use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index_or_local_user_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_invite_users::{Response::*, *};
use types::OCResult;

#[update(guard = "caller_is_user_index_or_local_user_index", msgpack = true)]
#[trace]
fn c2c_invite_users(args: Args) -> Response {
    run_regular_jobs();

    match mutate_state(|state| c2c_invite_users_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn c2c_invite_users_impl(args: Args, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    state.data.verify_not_frozen()?;

    let now = state.env.now();
    let result = state.data.invite_users(args.caller, args.users, now)?;

    if !state.data.chat.is_public.value {
        handle_activity_notification(state);
    }

    Ok(SuccessResult {
        invited_users: result.invited_users,
        group_name: result.group_name,
    })
}
