use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::c2c_leave_group::{Response::*, *};
use types::ParticipantLeft;

// Called via the user's user canister
#[update_msgpack]
#[trace]
fn c2c_leave_group(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_leave_group_impl(args, state))
}

fn c2c_leave_group_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = runtime_state.env.caller().into();
    let now = runtime_state.env.now();

    let participant = match runtime_state.data.participants.get_by_user_id(&caller) {
        Some(p) => p,
        None => return CallerNotInGroup,
    };

    if participant.suspended.value {
        return UserSuspended;
    }

    if participant.role.is_owner() && runtime_state.data.participants.owner_count() == 1 {
        return OwnerCannotLeave;
    }

    runtime_state.data.participants.remove(caller);

    let event = ParticipantLeft { user_id: caller };

    runtime_state
        .data
        .events
        .push_main_event(ChatEventInternal::ParticipantLeft(Box::new(event)), args.correlation_id, now);

    handle_activity_notification(runtime_state);

    Success(SuccessResult {})
}
