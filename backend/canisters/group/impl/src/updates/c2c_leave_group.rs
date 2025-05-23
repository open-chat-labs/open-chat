use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_leave_group::{Response::*, *};
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

    let caller = state.env.caller().into();
    let now = state.env.now();

    state.data.chat.leave(caller, now)?;
    state.data.remove_user(caller, Some(args.principal));

    handle_activity_notification(state);
    Ok(())
}
