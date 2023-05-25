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

fn c2c_leave_group_impl(runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = runtime_state.env.caller().into();
    let now = runtime_state.env.now();

    match runtime_state.data.chat.leave(caller, now) {
        LeaveResult::Success => {
            handle_activity_notification(runtime_state);
            Success(SuccessResult {})
        }
        LeaveResult::UserSuspended => UserSuspended,
        LeaveResult::LastOwnerCannotLeave => OwnerCannotLeave,
        LeaveResult::UserNotInGroup => CallerNotInGroup,
    }
}
