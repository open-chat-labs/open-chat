use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::c2c_leave_group::{Response::*, *};
use types::ParticipantLeft;

// Called via the user's user canister
#[update_msgpack]
#[trace]
fn c2c_leave_group(_args: Args) -> Response {
    run_regular_jobs();

    mutate_state(c2c_leave_group_impl)
}

fn c2c_leave_group_impl(runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller().into();
    let now = runtime_state.env.now();

    let participant = match runtime_state.data.participants.get_by_user_id(&caller) {
        Some(p) => p,
        None => return CallerNotInGroup,
    };

    if participant.role.is_owner() {
        return OwnerCannotLeave;
    }

    runtime_state.data.participants.remove(caller);

    let event = ParticipantLeft { user_id: caller };

    runtime_state
        .data
        .events
        .push_event(None, ChatEventInternal::ParticipantLeft(Box::new(event)), now);

    handle_activity_notification(runtime_state);

    Success(SuccessResult {})
}
