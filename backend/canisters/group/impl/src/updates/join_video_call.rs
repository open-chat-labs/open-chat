use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::JoinVideoCallResult;
use group_canister::join_video_call::{Response::*, *};
use ic_cdk_macros::update;

#[update]
#[trace]
fn join_video_call(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| join_video_call_impl(args, state))
}

fn join_video_call_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return GroupFrozen;
    }

    let caller = state.env.caller();

    if let Some(member) = state.data.get_member(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        let now = state.env.now();

        if let Some(min_visible_event_index) = state.data.chat.min_visible_event_index(Some(member.user_id)) {
            match state
                .data
                .chat
                .events
                .join_video_call(member.user_id, args.message_index, min_visible_event_index, now)
            {
                JoinVideoCallResult::Success => {
                    handle_activity_notification(state);
                    Success
                }
                JoinVideoCallResult::AlreadyJoined => Success,
                JoinVideoCallResult::MessageNotFound => MessageNotFound,
                JoinVideoCallResult::CallNotInProgress => CallNotInProgress,
            }
        } else {
            UserNotInGroup
        }
    } else {
        UserNotInGroup
    }
}
