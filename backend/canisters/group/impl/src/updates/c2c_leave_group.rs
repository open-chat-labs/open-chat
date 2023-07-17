use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_leave_group::{Response::*, *};
use group_chat_core::LeaveResult;

// Called via the user's user canister
#[update_msgpack]
#[trace]
fn c2c_leave_group(_args: Args) -> Response {
    run_regular_jobs();

    mutate_state(c2c_leave_group_impl)
}

fn c2c_leave_group_impl(state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = state.env.caller().into();
    let now = state.env.now();

    match state.data.chat.leave(caller, now) {
        LeaveResult::Success(_) => {
            state.data.remove_principal(caller);

            handle_activity_notification(state);

            Success(SuccessResult {})
        }
        LeaveResult::UserSuspended => UserSuspended,
        LeaveResult::LastOwnerCannotLeave => OwnerCannotLeave,
        LeaveResult::UserNotInGroup => CallerNotInGroup,
    }
}
