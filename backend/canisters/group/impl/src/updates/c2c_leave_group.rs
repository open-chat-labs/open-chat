use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_leave_group::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{Empty, OCResult};

// Called via the user's user canister
#[update(msgpack = true)]
#[trace]
fn c2c_leave_group(args: Args) -> Response {
    if let Err(error) = execute_update(|state| c2c_leave_group_impl(args, state)) {
        Error(error)
    } else {
        Success(Empty {})
    }
}

fn c2c_leave_group_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let caller = state.env.caller();
    let user_id = args.user_id.unwrap_or(caller.into());
    if user_id.canister_id() != caller {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }
    let now = state.env.now();

    let result = state.data.chat.leave(user_id, now)?;
    state.data.remove_user(user_id, Some(args.principal));

    state.push_bot_notification(result.bot_notification);
    handle_activity_notification(state);
    Ok(())
}
